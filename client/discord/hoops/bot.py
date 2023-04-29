import discord
import time
from tabulate import tabulate
from discord.ext import commands
from dotenv import load_dotenv
from os import getenv
import requests

load_dotenv()

BOT_TOKEN = getenv("BOT_TOKEN")

intents = discord.Intents.default()

intents.guilds = True
intents.messages = True
intents.message_content = True

bot = commands.Bot(command_prefix="/", intents=intents)

@bot.event
async def on_ready():
    print(f'We have logged in as {bot.user}')

@bot.event
async def on_message(message):
    if message.author == bot.user:
        return

    if message.content.startswith('/ask'):
        start_time = time.time()
        user_message = str(message.content).lower()
        natural_language_query = user_message.split('/ask ')[-1].strip()
        await message.channel.send(f"Working on: ** {natural_language_query} **")

        response = await fetch_data(natural_language_query=natural_language_query)

        end_time = time.time()
        time_taken =  "\nTime: "+ str(round(end_time - start_time, 2)) + " seconds"

        if (response is None or "result" not in response):
            await message.channel.send("Sorry! Couldn't get an answer for that :(" + time_taken)
            return

        table = format_response_data(response)
        bot_response = await message.channel.send(format_success_message(natural_language_query, table, message.author.mention, time_taken))
        thread = await bot_response.create_thread(name="_", auto_archive_duration=60)
        sql_query = format_sql_query(response)
        await thread.send(sql_query)

async def fetch_data(natural_language_query): 
    url = "https://nba-gpt-prod.onrender.com/text_to_sql"

    payload = {"natural_language_query": natural_language_query, "scope": "sports"}
    headers = {"Content-Type": "application/json"}

    response = requests.post(url, json=payload, headers=headers)

    return response.json()

def format_response_data(result):
    data = result["result"]["results"]
    column_names = result["result"]["column_names"]

    table_data = [[d.get(col, "") for col in column_names] for d in data]
    table = tabulate(table_data, headers=column_names)

    return table

def format_success_message(natural_language_query, table, author_mention, time_taken):
    basketball_emoji = chr(0x1F3C0)

    return """\n**{nlq}** asked by {author}
    
{emoji} Answer: ``` {table} ``` {time}
More Info:""".format(emoji=basketball_emoji, nlq=natural_language_query, table=table, author=author_mention, time=time_taken)

def format_sql_query(result):
    sql_query = result["sql_query"]
    return "\nSQL Code:```" + sql_query + "```"

bot.run(BOT_TOKEN)
