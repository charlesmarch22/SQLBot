import json
from typing import List


table_details = {}
with open("app/data/tables_new.json", "r") as f:
    table_details = json.load(f)

sf_table_details = {}
with open("app/data/sf_tables.json", "r") as f:
    sf_table_details = json.load(f)


def get_table_schemas(table_names: List[str] = None, scope="USA") -> str:
    tables_list = []

    if table_names:
        for table in table_details['tables']:
            if table['name'] in table_names:
                tables_list.append(table)
    elif scope == "USA":
        tables_list = table_details['tables']
    elif scope == "SF":
        tables_list = sf_table_details['tables']

    # return json.dumps(tables_list, indent=4)
    tables_str_list = []
    for table in tables_list:
        tables_str = f"table name: {table['name']}\n"
        tables_str += f"table description: {table['description']}\n"
        columns_str_list = []
        for column in table['columns']:
            # columns_str_list.append(f"{column['name']} ({column['type']})")
            if column.get('description'):
                columns_str_list.append(f"{column['name']} [{column['type']}] ({column['description']})")
            else:
                columns_str_list.append(f"{column['name']} [{column['type']}]")
        tables_str += f"table columns: {', '.join(columns_str_list)}\n"
        tables_str_list.append(tables_str)
    
    return "\n\n".join(tables_str_list)