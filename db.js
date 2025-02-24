/**
 * The `LocalDB` class represents a local database. Has properties to store the
 * database name, version, and DB connection, as well as methods for connecting
 * to the database, creating object stores based on a schema, and preparing
 * statements for database operations.
 */
class LocalDB {

  /**
   * Instantiates a LocalDB object
   * 
   * @param {string} dbName Machine name of the database to connect to
   * @param {number} version Version number, used for updating the DB
   */
  constructor(dbName, version = 2) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  /**
   * Opens a connection to the indexedDB database
   * 
   * @param {object} schema Object containing table names and key paths
   * @returns {object} Promise that resolves when the connection is established
   */
  async connect(schema = {}) {
    // Return a promise that resolves when the DB connection is established.
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      // Event handlers for the request object.
      request.onupgradeneeded = (event) => {
        this.db = event.target.result;
        for (let table in schema) {
          if (!this.db.objectStoreNames.contains(table)) {
            this.db.createObjectStore(table, {
              keyPath: schema[table].keyPath || "id",
              autoIncrement: true,
            });
          }
        }
      };

      // Event handlers for the request object.
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this);
      };

      // Event handlers for the request object.
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Prepares a statement for execution.
   * 
   * @param {string} table Name of the table to operate on
   * @returns {object} Instance of LocalStatement object
   */
  prepare(table) {
    return new LocalStatement(this.db, table);
  }

} // end class LocalDB

/**
 * The `LocalStatement` class represents a statement to be executed on a local
 * database. Has properties for the database connection, table name, action to
 * perform, and values to use in the operation.
 */
class LocalStatement {

  // Constants for sorting direction.
  static SORT_ASC = "asc";
  static SORT_DESC = "desc";

  /**
   * Instantiates a LocalStatement object
   * 
   * @param {string} db Database connection object
   * @param {string} table Name of the table to operate on
   */
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.action = null;
    this.values = null;
    this.conditions = [];
    this.selectedFields = null; // stores selected fields
    this.sortField = null;
    // Set sort direction to ASC by default.
    this.sortDir = LocalStatement.SORT_ASC;
    this.resultLimit = null;
    this.resultOffset = 0;
  }

  /**
   * Sets the action to insert and assigns values to the statement.
   * 
   * @param {object} values Object containing values to insert
   * @returns {object} Instance of LocalStatement object (method chaining)
   */
  insert(values) {
    this.action = "insert";
    this.values = values;
    return this;
  }

  /**
   * Sets the action to select.
   * 
   * @returns {object} Instance of LocalStatement object (method chaining)
   */
  select(fields = ["*"]) {
    this.action = "select";
    this.selectedFields = Array.isArray(fields)
        ? fields     // already an array, pass as is
        : typeof fields === "string"
          ? [fields] // if single field passed as string, array-ify it
          : ["*"];   // otherwise, default to SELECT * ...
    return this;
  }

  /**
   * Sets the action to update and assigns values to the statement.
   * 
   * @param {object} values Object containing values to update
   * @returns {object} Instance of LocalStatement object (method chaining)
   */
  update(values) {
    this.action = "update";
    this.values = values;
    return this;
  }

  /**
   * Sets the action to delete.
   * 
   * @returns {object} Instance of LocalStatement object (method chaining)
   */
  delete() {
    this.action = "delete";
    return this;
  }

  /**
   * Binds values to the statement.
   * 
   * @param {object} values Object containing values to bind
   * @returns {object} Instance of LocalStatement object (method chaining)
   */
  bindValues(values) {
    this.values = values;
    return this;
  }

  /**
   * Sets the WHERE conditions for the statement.
   * 
   * @param {array|object} conditions Array or object of conditions
   * @returns {object} Instance of LocalStatement object (method chaining)
   */
  where(conditions) {
    this.conditions = conditions;
    return this;
  }

  /**
   * Sets the ORDER BY clause for the statement.
   * 
   * @param {string} field Field to order by
   * @param {string} direction Sort direction (asc or desc)
   * @returns {object} Instance of LocalStatement object (method chaining)
   */
  orderBy(field, direction = LocalStatement.SORT_ASC) {
    this.sortField = field;
    this.sortDir = LocalStatement.SORT_DESC.toLowerCase();
    return this;
  }

  /**
   * Sets the LIMIT clause for the statement.
   * 
   * @param {number} n Number of records to limit the result
   * @returns {object} Instance of LocalStatement object (method chaining)
   */
  limit(n) {
    this.resultLimit = Math.max(1, n);
    return this;
  }

  /**
   * Sets the OFFSET clause for the statement.
   * 
   * @param {number} n Number of records to offset the result
   * @returns {object} Instance of LocalStatement object (method chaining)
   */
  offset(n) {
    this.resultOffset = Math.max(0, n);
    return this;
  }

  /**
   * Executes the statement.
   * 
   * @returns {object} Promise that resolves when the statement is executed
   */
  async execute() {
    // Return a promise that resolves when the statement is executed.
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.table, "readwrite");
      const store = tx.objectStore(this.table);
      let request;

      // Determine the action to take based on the statement.
      switch (this.action) {
        case "insert":
          request = store.add(this.values);
          break;
        case "update":
          request = store.put(this.values);
          break;
        case "delete":
          request = store.delete(this.values.id);
          break;
        default:
          reject("Invalid action");
      }

      // Event handlers for the request object.
      request.onsuccess = () => resolve(request.result);
      request.onerror   = () => reject(request.error);
    });
  }

  /**
   * Fetches a single record from the database.
   * 
   * @returns {object} Promise that resolves with the fetched record
   */
  async fetchAll() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.table, "readonly");
      const store = tx.objectStore(this.table);
      const request = store.getAll();

      request.onsuccess = () => {
        let results = request.result;

        // Apply filters using our WHERE logic.
        if (this.conditions.length > 0) {
          results = results.filter(
            item => this.evaluateConditions(item, this.conditions)
          );
        }

        // Apply sorting.
        if (this.sortField) {
          results.sort((a, b) => this.compareValues(a, b));
        }

        // Apply pagination.
        results = results.slice(
          this.resultOffset,
          this.resultLimit ? this.resultOffset + this.resultLimit : undefined
        );
        
        // Apply field selection
        if (this.selectedFields && this.selectedFields[0] !== "*") {
          results = results.map(item =>
            this.selectedFields.reduce((obj, key) => {
              if (key in item) obj[key] = item[key];
              return obj;
            }, {})
          );
        }

        resolve(results);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Evaluates the conditions for a given item.
   * 
   * @param {Promise} item Item to evaluate conditions against
   * @param {array|object} conditions Conditions to evaluate against the item
   * @param {boolean} isOr Whether this is an OR condition
   * @returns {boolean} Result of the evaluation
   */
  evaluateConditions(item, conditions, isOr = false) {
    const results = conditions.map(condition => {
      if (Array.isArray(condition)) {
        // Simple condition: [field, operator, value].
        const [field, op, value] = condition;
        return this.applyFilters(item[field], op, value);
      } else if (typeof condition === "object") {
        // More complex nested conditions.
        if (condition.AND) {
          return this.evaluateConditions(item, condition.AND, false);
        } else if (condition.OR) {
          return this.evaluateConditions(item, condition.OR, true);
        }
      }

      return false;
    });

    return isOr ? results.some(Boolean) : results.every(Boolean);
  }

  /**
   * Applies a filter to a given value.
   * 
   * @param {any} compare Value to compare against
   * @param {string} op Operator to use in the comparison
   * @param {any} value Value to compare to
   * @returns {boolean} Result of the comparison
   */
  applyFilter(compare, op, value) {
    switch (op.toLowerCase()) {
      case "=":
        return compare === value;
      case "!=":
        return compare !== value;
      case "<":
        return compare < value;
      case "<=":
        return compare <= value;
      case ">":
        return compare > value;
      case ">=":
        return compare >= value;
      case "in":
      case "within":
        return Array.isArray(value) && value.includes(compare);
      case "like":
        return new RegExp(value.replace("%", ".*"), "i").test(compare);
      default:
        return false;
    }
  }

  /**
   * Compares two values for sorting.
   * 
   * @param {any} a Value to compare
   * @param {any} b Value to compare
   * @returns {number} Result of the comparison
   */
  compareValues(a, b) {
    const field = this.sortField;
    if (
      !Object.prototype.hasOwnProperty.call(a, field) ||
      !Object.prototype.hasOwnProperty.call(b, field)
    ) {
      return 0;
    }

    const valA = a[field];
    const valB = b[field];

    // Handle string comparison.
    if (typeof valA === "string" && typeof valB === "string") {
      return this.sortDir === LocalStatement.SORT_ASC
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }
    return this.sortDir === LocalStatement.SORT_ASC ? valA - valB : valB - valA;
  }

} // end class LocalStatement

export { LocalDB, LocalStatement };
