from app.generation_engine.streaming_table_selection import get_tables
from app.generation_engine.streaming_sql_generation import text_to_sql_with_retry
from app.generation_engine.example_picker import similar_examples_from_pinecone
from app.generation_engine.utils import cleaner


class Engine:

    query = ''
    table_selection_method = 'llm'
    tables = []
    selected_examples = []

    def __init__(self, table_selection_method='llm'):
        self.table_selection_method = table_selection_method

    def set_query(self, query):
        self.query = cleaner.clean_input(query)

    def run(self):
        yield {"status": "working", "state": "Query Received", "step": "query"}

        for res in self.get_tables():
            if res['status'] == 'error':
                return res
            yield res

        self.get_examples()

        for res in self.get_sql():
            if res['status'] == 'error':
                print('hit error')
                return res
            yield res

    def get_tables(self):
        yield {"status": "working", "state": "Acquiring Tables", "step": "tables"}

        try:
            new_tables = get_tables(
                self.query, method=self.table_selection_method)
            self.tables = new_tables
            yield {"status": "working", "state": "Tables Acquired", "tables": new_tables, "step": "tables"}
        except Exception as e:
            yield {"status": "error", "error": str(e), 'step': 'tables'}

    def get_enums(self):
        # todo
        pass

    def get_examples(self):
        print('getting examples')
        self.selected_examples = similar_examples_from_pinecone(self.query)
        print('got examples')
        pass

    def get_sql(self):
        try:
            for res in text_to_sql_with_retry(self.query, self.tables, examples=self.selected_examples):
                yield res
            print('done with get_sql')
        except Exception as exc:
            print('error in get_sql: ', exc)
            return
