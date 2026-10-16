import { test, expect } from '@playwright/test';
import { parseConnectionInput } from '../../supabase/functions/data-sources/connectionInput';
import { describeConnectionError, describeSqlServerError } from '../../supabase/functions/data-sources/connectionErrors';
import { buildSqlServerStructure, checkValues, sqlServerType } from '../../supabase/functions/data-sources/sqlserverStructure';
import { readStructure } from '../../supabase/functions/data-sources/introspect';
import { checkSql } from '../../supabase/functions/query/checkSql';
import { buildPrompt, describeStructure, MAX_ROWS } from '../../supabase/functions/query/describeStructure';

// Pure logic behind Query (SPA-487..492) — no database, no AI, no browser.

const config = { type: 'postgres' as const, host: 'db.example.com', port: 5432, database: 'shop', username: 'reader', password: 'x', ssl: true };

// A small shop, shaped like what introspect.ts stores.
const shop = {
  tables: [
    {
      schema: 'public',
      name: 'customers',
      kind: 'table',
      comment: 'People who buy from the shop',
      columns: [
        { name: 'id', type: 'integer', nullable: false, comment: null },
        { name: 'country', type: 'text', nullable: true, comment: null },
      ],
      primaryKey: ['id'],
      foreignKeys: [],
    },
    {
      schema: 'public',
      name: 'orders',
      kind: 'table',
      comment: null,
      columns: [
        { name: 'id', type: 'integer', nullable: false, comment: null },
        { name: 'customer_id', type: 'integer', nullable: false, comment: null },
        { name: 'status', type: 'order_status', nullable: false, comment: 'Where the order is' },
      ],
      primaryKey: ['id'],
      foreignKeys: [{ columns: ['customer_id'], references: { schema: 'public', table: 'customers', columns: ['id'] } }],
    },
  ],
  enums: [{ schema: 'public', name: 'order_status', values: ['paid', 'cancelled'] }],
};

test.describe('parseConnectionInput', () => {
  test('trims the fields and fills in the defaults', () => {
    const parsed = parseConnectionInput({ host: '  db.example.com ', database: ' shop', username: 'reader ', password: ' p w ' });
    expect(parsed).toEqual({
      config: { type: 'postgres', host: 'db.example.com', port: 5432, database: 'shop', username: 'reader', password: ' p w ', ssl: true },
    });
  });

  test('keeps the port and SSL it is given', () => {
    const parsed = parseConnectionInput({ ...config, port: '6543', ssl: false });
    expect(parsed).toEqual({ config: { ...config, port: 6543, ssl: false } });
  });

  test('says what is missing or wrong', () => {
    expect(parseConnectionInput({ ...config, host: ' ' })).toEqual({ error: 'Host is required' });
    expect(parseConnectionInput({ ...config, port: 70000 })).toEqual({ error: 'Port must be a number between 1 and 65535' });
    expect(parseConnectionInput({ ...config, port: 'abc' })).toEqual({ error: 'Port must be a number between 1 and 65535' });
    expect(parseConnectionInput({ ...config, database: '' })).toEqual({ error: 'Database is required' });
    expect(parseConnectionInput({ ...config, username: '' })).toEqual({ error: 'Username is required' });
    expect(parseConnectionInput({ ...config, password: '' })).toEqual({ error: 'Password is required' });
  });
});

test.describe('describeConnectionError', () => {
  test('turns driver errors into something to act on', () => {
    expect(describeConnectionError({ code: '28P01' }, config)).toBe('Wrong username or password.');
    expect(describeConnectionError({ code: '3D000' }, config)).toBe(`The database "shop" doesn't exist on this server.`);
    expect(describeConnectionError({ code: 'ENOTFOUND' }, config)).toContain(`Couldn't find the host "db.example.com"`);
    expect(describeConnectionError({ code: 'ECONNREFUSED' }, config)).toContain('db.example.com:5432 refused the connection');
    expect(describeConnectionError({ code: 'CONNECT_TIMEOUT' }, config)).toContain("didn't answer within 5 seconds");
    expect(describeConnectionError({ message: 'self-signed certificate' }, config)).toContain('Try with SSL off');
  });

  test('anything else keeps its message, after the prefix', () => {
    expect(describeConnectionError({ message: 'boom' }, config)).toBe("Couldn't connect: boom");
    expect(describeConnectionError({ message: 'boom' }, config, '')).toBe('boom');
  });
});

test.describe('readStructure', () => {
  // Stands in for the driver: answers the three catalog queries in order.
  function fakeSql(columns: object[], keys: object[], enums: object[]) {
    const answers = [columns, keys, enums];
    return { unsafe: async () => answers.shift() };
  }

  test('groups columns into tables and attaches their keys', async () => {
    const sql = fakeSql(
      [
        { schema: 'public', table: 'orders', kind: 'r', table_comment: null, column: 'id', type: 'integer', nullable: false, column_comment: null },
        { schema: 'public', table: 'orders', kind: 'r', table_comment: null, column: 'customer_id', type: 'integer', nullable: false, column_comment: null },
        { schema: 'sales', table: 'monthly', kind: 'v', table_comment: 'Per month', column: 'total', type: 'numeric(10,2)', nullable: true, column_comment: null },
      ],
      [
        { type: 'p', schema: 'public', table: 'orders', columns: ['id'], ref_schema: null, ref_table: null, ref_columns: [] },
        { type: 'f', schema: 'public', table: 'orders', columns: ['customer_id'], ref_schema: 'public', ref_table: 'customers', ref_columns: ['id'] },
        // A key on a table the user can't read is dropped.
        { type: 'p', schema: 'secret', table: 'salaries', columns: ['id'], ref_schema: null, ref_table: null, ref_columns: [] },
      ],
      [
        { schema: 'public', name: 'order_status', values: ['paid', 'cancelled'] },
        // Enums in schemas with no readable tables are left out.
        { schema: 'auth', name: 'aal_level', values: ['aal1'] },
      ],
    );

    const structure = await readStructure(sql, 'ds-1', 'shop');

    expect(structure.dataSourceId).toBe('ds-1');
    expect(structure.database).toBe('shop');
    expect(structure.tables.map((t) => `${t.schema}.${t.name}:${t.kind}`)).toEqual(['public.orders:table', 'sales.monthly:view']);
    const orders = structure.tables[0]!;
    expect(orders.columns.map((c) => c.name)).toEqual(['id', 'customer_id']);
    expect(orders.primaryKey).toEqual(['id']);
    expect(orders.foreignKeys).toEqual([
      { columns: ['customer_id'], references: { schema: 'public', table: 'customers', columns: ['id'] } },
    ]);
    expect(structure.tables[1]!.comment).toBe('Per month');
    expect(structure.enums).toEqual([{ schema: 'public', name: 'order_status', values: ['paid', 'cancelled'] }]);
  });
});

test.describe('checkSql', () => {
  test('lets a single SELECT through, without trailing semicolons', () => {
    expect(checkSql('  select 1;  ')).toEqual({ sql: 'select 1' });
    expect(checkSql('SELECT name FROM public.products;;')).toEqual({ sql: 'SELECT name FROM public.products' });
    expect(checkSql('with t as (select 1) select * from t')).toEqual({ sql: 'with t as (select 1) select * from t' });
  });

  test('refuses anything else', () => {
    expect(checkSql('')).toEqual({ error: 'No query was generated.' });
    expect(checkSql('select 1; drop table orders')).toEqual({
      error: "The generated SQL has more than one statement, so it wasn't run.",
    });
    expect(checkSql('delete from public.orders')).toEqual({
      error: "The generated SQL isn't a SELECT query, so it wasn't run.",
    });
    expect(checkSql('selection from x')).toEqual({ error: "The generated SQL isn't a SELECT query, so it wasn't run." });
  });
});

test.describe('describeStructure / buildPrompt', () => {
  test('one line per column, with keys, required columns and enum values', () => {
    const text = describeStructure(shop);
    expect(text).toContain('public.customers (table) — People who buy from the shop');
    expect(text).toContain('  - id integer PK not null');
    expect(text).toContain('  - country text');
    expect(text).toContain('  - customer_id integer not null → public.customers.id');
    expect(text).toContain('  - status order_status not null — Where the order is');
    expect(text).toContain("  - public.order_status: 'paid', 'cancelled'");
  });

  test('the prompt carries the structure, the rules and the question', () => {
    const prompt = buildPrompt(shop, '¿Cuántos pedidos se cancelaron?', '2026-10-16');
    expect(prompt).toContain(describeStructure(shop));
    expect(prompt).toContain('a single SELECT');
    expect(prompt).toContain(`At most ${MAX_ROWS} rows`);
    expect(prompt).toContain('Today is 2026-10-16');
    expect(prompt.trimEnd().endsWith('Question: ¿Cuántos pedidos se cancelaron?')).toBe(true);
  });
});

// ── SQL Server ───────────────────────────────────────────────────────────────

const azure = { ...config, type: 'sqlserver' as const, host: 'shop.database.windows.net', port: 1433 };

test.describe('SQL Server — connection input and errors', () => {
  test('the engine sets the default port, and unknown engines are refused', () => {
    const parsed = parseConnectionInput({ type: 'sqlserver', host: 'shop.database.windows.net', database: 'shop', username: 'reader', password: 'p' });
    expect(parsed).toEqual({ config: { ...azure, password: 'p' } });
    expect(parseConnectionInput({ ...azure, type: 'oracle' })).toEqual({ error: 'Database type must be PostgreSQL or SQL Server' });
  });

  test("Azure's firewall, logins and missing databases are told apart", () => {
    const blocked = {
      message: "Cannot open server 'shop' requested by the login. Client with IP address '20.1.2.3' is not allowed to access the server.",
      number: 40615,
    };
    expect(describeSqlServerError(blocked, azure)).toBe(
      "The server's firewall refused the connection from 20.1.2.3. Allow that address (or the portal's range) in the server's Networking settings.",
    );
    expect(describeSqlServerError({ code: 'ELOGIN', message: "Login failed for user 'reader'." }, azure)).toBe('Wrong username or password.');
    expect(describeSqlServerError({ number: 4060, message: 'Cannot open database "shop"' }, azure)).toContain(`The database "shop" doesn't exist`);
    expect(describeSqlServerError({ code: 'ETIMEOUT', message: 'Failed to connect in 30000ms' }, azure)).toContain("didn't answer within 30 seconds. If it's an Azure SQL serverless database");
    expect(describeSqlServerError({ message: 'boom' }, azure, '')).toBe('boom');
    expect(describeSqlServerError({ message: 'Failed to connect to x:1433 - read ECONNRESET' }, azure)).toContain(
      'closed the connection while setting up encryption',
    );
  });
});

test.describe('SQL Server — structure', () => {
  test('types keep their length and precision', () => {
    expect(sqlServerType({ data_type: 'nvarchar', max_length: 100 })).toBe('nvarchar(100)');
    expect(sqlServerType({ data_type: 'varchar', max_length: -1 })).toBe('varchar(max)');
    expect(sqlServerType({ data_type: 'decimal', precision: 10, scale: 2 })).toBe('decimal(10,2)');
    expect(sqlServerType({ data_type: 'datetime2' })).toBe('datetime2');
  });

  test('a CHECK that lists fixed values becomes the column’s allowed values', () => {
    expect(checkValues("([status]='pending' OR [status]='paid' OR [status]='it''s')")).toEqual({
      column: 'status',
      values: ['pending', 'paid', "it's"],
    });
    // Anything else isn't a list of values.
    expect(checkValues('([unit_price]>(0))')).toBeNull();
    expect(checkValues("([a]='x' OR [b]='y')")).toBeNull();
    expect(checkValues("([status]='x' AND [qty]>(1))")).toBeNull();
  });

  test('catalog rows become the same structure Postgres produces', () => {
    const structure = buildSqlServerStructure(
      {
        columns: [
          { schema: 'dbo', table: 'orders', kind: 'BASE TABLE', column: 'id', data_type: 'int', is_nullable: 'NO', table_comment: 'One purchase' },
          { schema: 'dbo', table: 'orders', kind: 'BASE TABLE', column: 'customer_id', data_type: 'int', is_nullable: 'NO' },
          { schema: 'dbo', table: 'orders', kind: 'BASE TABLE', column: 'status', data_type: 'varchar', max_length: 20, is_nullable: 'NO' },
          { schema: 'dbo', table: 'monthly', kind: 'VIEW', column: 'total', data_type: 'decimal', precision: 10, scale: 2, is_nullable: 'YES' },
        ],
        primaryKeys: [{ schema: 'dbo', table: 'orders', column: 'id' }],
        foreignKeys: [
          { fk_name: 'FK_orders_customers', schema: 'dbo', table: 'orders', column: 'customer_id', ref_schema: 'dbo', ref_table: 'customers', ref_column: 'id' },
        ],
        checks: [{ schema: 'dbo', table: 'orders', definition: "([status]='paid' OR [status]='cancelled')" }],
      },
      'ds-2',
      'shop',
    );

    expect(structure.tables.map((t: any) => `${t.schema}.${t.name}:${t.kind}`)).toEqual(['dbo.orders:table', 'dbo.monthly:view']);
    const orders = structure.tables[0];
    expect(orders.comment).toBe('One purchase');
    expect(orders.primaryKey).toEqual(['id']);
    expect(orders.foreignKeys).toEqual([{ columns: ['customer_id'], references: { schema: 'dbo', table: 'customers', columns: ['id'] } }]);
    expect(orders.columns[2]).toEqual({ name: 'status', type: 'varchar(20)', nullable: false, comment: null, values: ['paid', 'cancelled'] });
    expect(structure.tables[1].columns[0]).toMatchObject({ type: 'decimal(10,2)', nullable: true });
    expect(structure.enums).toEqual([]);
  });
});

test.describe('SQL Server — prompt', () => {
  test('asks for T-SQL with TOP instead of LIMIT, and lists the allowed values', () => {
    const tsql = {
      tables: [
        {
          schema: 'dbo',
          name: 'orders',
          kind: 'table',
          comment: null,
          columns: [{ name: 'status', type: 'varchar(20)', nullable: false, comment: null, values: ['paid', 'cancelled'] }],
          primaryKey: [],
          foreignKeys: [],
        },
      ],
      enums: [],
    };
    const prompt = buildPrompt(tsql, 'How many orders were cancelled?', '2026-10-16', 'sqlserver');
    expect(prompt).toContain('You write Microsoft SQL Server (T-SQL) queries');
    expect(prompt).toContain('use SELECT TOP (n), never LIMIT');
    expect(prompt).toContain('(e.g. dbo.orders)');
    expect(prompt).toContain("  - status varchar(20) not null (one of 'paid', 'cancelled')");
    expect(prompt).not.toContain('ILIKE');
  });

  test('Postgres keeps its own dialect', () => {
    const prompt = buildPrompt(shop, 'q', '2026-10-16');
    expect(prompt).toContain('You write PostgreSQL queries');
    expect(prompt).toContain('add a LIMIT');
  });
});
