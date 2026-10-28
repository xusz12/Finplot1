import initSqlJs from 'sql.js'
const SQL = await initSqlJs()
const schema = `
  CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT);
  INSERT INTO metadata VALUES ('schema_version','3');
  CREATE TABLE category_groups (id INTEGER PRIMARY KEY, code TEXT, name TEXT, direction TEXT, active INTEGER, sort_order INTEGER);
  CREATE TABLE categories (id INTEGER PRIMARY KEY, code TEXT, group_id INTEGER REFERENCES category_groups(id), name TEXT, direction TEXT, nature TEXT, active INTEGER, sort_order INTEGER);
  CREATE TABLE transactions (id INTEGER PRIMARY KEY, occurred_at TEXT, direction TEXT, amount_cents INTEGER, category_id INTEGER REFERENCES categories(id), note TEXT, source_category TEXT, source_record_id TEXT);
  CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT);
  CREATE TABLE transaction_tags (transaction_id INTEGER REFERENCES transactions(id), tag_id INTEGER REFERENCES tags(id), source TEXT);
  INSERT INTO category_groups VALUES (1,'daily','生活','支出',1,1),(2,'work','工作','收入',1,2),(3,'investment_out','投资支出','支出',1,3),(4,'investment_in','投资收入','收入',1,4),(5,'retired','历史停用','支出',0,5);
  INSERT INTO categories VALUES (1,'food',1,'餐饮','支出','日常',1,1),(2,'salary',2,'工资','收入','日常',1,2),(3,'loss',3,'投资亏损','支出','投资',1,3),(4,'gain',4,'投资收益','收入','投资',1,4),(5,'transfer',5,'转账支出','支出','往来',0,5),(6,'adjustment',1,'调整支出','支出','调整',0,6);
`
const records = `
  INSERT INTO transactions VALUES
    (1,'2025-01-01 09:00:00','收入',10000,2,NULL,NULL,NULL),
    (2,'2025-01-02 10:00:00','支出',10,1,NULL,NULL,NULL),
    (3,'2025-01-02 10:00:00','支出',20,1,'同名备注',NULL,NULL),
    (4,'2025-01-02 12:00:00','收入',500,4,'同名备注',NULL,NULL),
    (5,'2025-01-03 12:00:00','支出',700,3,NULL,NULL,NULL),
    (6,'2025-01-04 12:00:00','支出',1000,5,NULL,NULL,NULL),
    (7,'2025-01-05 12:00:00','支出',1,6,NULL,NULL,NULL),
    (8,'2026-01-02 12:00:00','支出',200,1,NULL,NULL,NULL);
  INSERT INTO tags VALUES (1,'标签 A'),(2,'标签, B');
  INSERT INTO transaction_tags VALUES (3,1,'manual'),(3,2,'inferred');
`
export function fixture(extra = '', includeRecords = true) {
  const db = new SQL.Database()
  try { db.run(schema + (includeRecords ? records : '') + extra); return db.export() }
  finally { db.close() }
}
