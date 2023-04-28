from flask import Blueprint, jsonify, make_response, request, stream_with_context, Response

from ..config import PINECONE_ENV, PINECONE_KEY
from ..table_selection.utils import (get_relevant_tables_from_lm,
                                     get_relevant_tables_from_pinecone)
from .utils import text_to_sql_with_retry

from app.generation_engine import streaming_helper

bp = Blueprint('sql_generation_bp', __name__)


@bp.route('/text_to_sql', methods=['POST'])
def text_to_sql():
    """
    Convert natural language query to SQL
    """
    print('checking tables')
    request_body = request.get_json()
    natural_language_query = request_body.get("natural_language_query")
    table_names = request_body.get("table_names")

    if not natural_language_query:
        error_msg = "`natural_language_query` is missing from request body"
        return make_response(jsonify({"error": error_msg}), 400)

    try:
        if not table_names:
            if PINECONE_ENV and PINECONE_KEY:
                table_names = get_relevant_tables_from_pinecone(
                    natural_language_query)
            else:

                table_names = get_relevant_tables_from_lm(
                    natural_language_query, ignore_comments=True)

        result, sql_query = text_to_sql_with_retry(
            natural_language_query, table_names)
    except Exception as e:
        error_msg = f"Error processing request: {str(e)}"
        return make_response(jsonify({"error": error_msg}), 500)

    return make_response(jsonify({"result": result, "sql_query": sql_query}), 200)


@bp.route('/text_to_sql_streaming', methods=['POST'])
def text_to_sql_streaming():
    """
    Convert natural language query to SQL
    """

    request_body = request.get_json()

    return Response(stream_with_context(streaming_helper.stream_sql_response(request_body)), content_type="application/json")


@bp.route('/text_to_sql_unified', methods=['POST'])
def text_to_sql_streaming():
    """
    Convert natural language query to SQL
    """

    request_body = request.get_json()

    if "stream" in request_body:
        return Response(stream_with_context(streaming_helper.stream_sql_response(request_body)), content_type="application/json")

    else:
        # get all the responses from the generator until there's an error (and return that) or until it's done (and return the last response)
        responses = []
        for response in streaming_helper.stream_sql_response(request_body):
            responses.append(response)
            if "error" in response:
                return make_response(jsonify(response), 500)
        return make_response(jsonify(responses[-1]), 200)
