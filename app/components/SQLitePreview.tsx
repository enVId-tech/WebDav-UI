"use client";
import React, { useEffect, useState, useRef } from 'react';
import styles from '@/app/styles/sqlitePreview.module.scss';

interface SQLitePreviewProps {
  src: string;
  fileName: string;
}

interface TableInfo {
  name: string;
  sql: string;
}

interface QueryResult {
  columns: string[];
  values: any[][];
}

const SQLitePreview: React.FC<SQLitePreviewProps> = ({ src, fileName }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sqlJs, setSqlJs] = useState<any>(null);
  const [db, setDb] = useState<any>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [customQuery, setCustomQuery] = useState('');
  const [rowLimit, setRowLimit] = useState(100);
  const dbRef = useRef<any>(null);

  // Load sql.js library
  useEffect(() => {
    const loadSqlJs = async () => {
      try {
        // Load sql.js from CDN
        const initSqlJs = (window as any).initSqlJs;
        if (!initSqlJs) {
          // Dynamically load the script
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js';
          script.async = true;
          
          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load sql.js'));
            document.head.appendChild(script);
          });
        }
        
        const SQL = await (window as any).initSqlJs({
          locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
        });
        setSqlJs(SQL);
      } catch (err: any) {
        console.error('Error loading sql.js:', err);
        setError('Failed to load SQLite viewer library');
        setIsLoading(false);
      }
    };

    loadSqlJs();
  }, []);

  // Load the database file
  useEffect(() => {
    if (!sqlJs) return;

    const loadDatabase = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch the database file
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`Failed to fetch database: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Create database instance
        const database = new sqlJs.Database(uint8Array);
        dbRef.current = database;
        setDb(database);

        // Get all tables
        const tablesQuery = database.exec(`
          SELECT name, sql FROM sqlite_master 
          WHERE type='table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `);

        if (tablesQuery.length > 0 && tablesQuery[0].values.length > 0) {
          const tableList: TableInfo[] = tablesQuery[0].values.map((row: any) => ({
            name: row[0] as string,
            sql: row[1] as string
          }));
          setTables(tableList);
          
          // Select the first table by default
          if (tableList.length > 0) {
            setSelectedTable(tableList[0].name);
          }
        } else {
          setError('No tables found in database');
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error('Error loading database:', err);
        setError(err.message || 'Failed to load database file');
        setIsLoading(false);
      }
    };

    loadDatabase();

    // Cleanup
    return () => {
      if (dbRef.current) {
        try {
          dbRef.current.close();
        } catch (e) {
          console.error('Error closing database:', e);
        }
      }
    };
  }, [sqlJs, src]);

  // Query the selected table
  useEffect(() => {
    if (!db || !selectedTable) return;

    try {
      const query = `SELECT * FROM "${selectedTable}" LIMIT ${rowLimit}`;
      const result = db.exec(query);

      if (result.length > 0) {
        setQueryResult({
          columns: result[0].columns,
          values: result[0].values
        });
      } else {
        setQueryResult({ columns: [], values: [] });
      }
    } catch (err: any) {
      console.error('Error querying table:', err);
      setError(`Failed to query table: ${err.message}`);
    }
  }, [db, selectedTable, rowLimit]);

  const executeCustomQuery = () => {
    if (!db || !customQuery.trim()) return;

    try {
      setError(null);
      const result = db.exec(customQuery);

      if (result.length > 0) {
        setQueryResult({
          columns: result[0].columns,
          values: result[0].values
        });
      } else {
        setQueryResult({ columns: [], values: [] });
        setError('Query executed successfully but returned no results');
      }
    } catch (err: any) {
      console.error('Error executing query:', err);
      setError(`Query error: ${err.message}`);
    }
  };

  const exportToCSV = () => {
    if (!queryResult || queryResult.values.length === 0) return;

    const csv = [
      queryResult.columns.join(','),
      ...queryResult.values.map(row => 
        row.map(cell => {
          const cellStr = cell === null ? '' : String(cell);
          // Escape quotes and wrap in quotes if contains comma or quote
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable || 'query'}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading SQLite database...</p>
        </div>
      </div>
    );
  }

  if (error && !db) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error Loading Database</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.fileName}>{fileName}</h2>
        <div className={styles.info}>
          <span>{tables.length} table{tables.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <h3>Tables</h3>
          <div className={styles.tableList}>
            {tables.map((table) => (
              <button
                key={table.name}
                className={`${styles.tableItem} ${selectedTable === table.name ? styles.active : ''}`}
                onClick={() => setSelectedTable(table.name)}
              >
                {table.name}
              </button>
            ))}
          </div>

          <div className={styles.controls}>
            <label>
              Row Limit:
              <select 
                value={rowLimit} 
                onChange={(e) => setRowLimit(Number(e.target.value))}
                className={styles.select}
              >
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </label>
          </div>
        </div>

        <div className={styles.main}>
          {selectedTable && (
            <div className={styles.tableSchema}>
              <h4>Table: {selectedTable}</h4>
              <pre className={styles.schemaSql}>
                {tables.find(t => t.name === selectedTable)?.sql}
              </pre>
            </div>
          )}

          <div className={styles.querySection}>
            <h4>Custom Query</h4>
            <div className={styles.queryInput}>
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="Enter SQL query..."
                className={styles.textarea}
                rows={3}
              />
              <button onClick={executeCustomQuery} className={styles.executeButton}>
                Execute Query
              </button>
            </div>
          </div>

          {error && db && (
            <div className={styles.queryError}>
              {error}
            </div>
          )}

          {queryResult && (
            <div className={styles.results}>
              <div className={styles.resultsHeader}>
                <h4>Results ({queryResult.values.length} rows)</h4>
                {queryResult.values.length > 0 && (
                  <button onClick={exportToCSV} className={styles.exportButton}>
                    Export to CSV
                  </button>
                )}
              </div>
              
              {queryResult.values.length > 0 ? (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        {queryResult.columns.map((col, idx) => (
                          <th key={idx}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.values.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx}>
                              {cell === null ? (
                                <span className={styles.null}>NULL</span>
                              ) : typeof cell === 'object' ? (
                                <span className={styles.blob}>BLOB</span>
                              ) : (
                                String(cell)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.noResults}>No results</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SQLitePreview;
