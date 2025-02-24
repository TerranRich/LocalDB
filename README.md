# LocalDB
Introducing **LocalDB**, a custom JavaScript framework for queries into indexedDB object stores and records. Queries are structured using method chaining in a SQL-like pattern. Examples are provided below.

## Installation
Until this is registered this with NPM, simply add `db.js` to your project and import using `import { LocalDB, LocalStatement } from './db.js';`.

## Usage
To start, instantiate the database connection:

```js
const db = new LocalDB("MyDatabaseNameHere");

await db.connect({
  tableNameHere: { keyPath: "id" } // can use anything, but "id" is most common
});
```

### Insert a Record
To insert a record, such as an entry into a "users" table, use the `.insert()` method.

```js
await db.prepare("users")
  .insert({
    name: "Alice",
    email: "alice@example.com",
  })
  .execute();
```

SQL equivalent: `INSERT INTO users FIELDS (name, email) VALUES ("Alice", "alice@example.com")`.

### Update a Record
To upate a record, pass a JSON object with field name => field value pairings to the `.update()` method.

```js
await DB.prepare("users")
  .update({
    id: 123,  // this is the ID of the record we will update
    name: "Bob",  // everything else is the data to update
    email: "bob@example.com",
  })
  .execute();
```

SQL equivalent: `UPDATE users SET name = "Bob", email = "bob@example.com" WHERE id = 123`.

### Delete a Record
To delete a record, simple pass the record's unique ID to the `.delete()` method.

```js
await DB.prepare("users")
  .delete()
  .where(["id", "=", 456])
  .execute();
```

This is the equivalent of the SQL query: `DELETE FROM users WHERE id = 456`.

### Select Records
There are various methods at your disposal when it comes to selecting one or more records from the database.

#### All Records
To select *all* records, use the `.select()` method.

```js
const users = await db.prepare("users")
  .select()
  .fetchAll();
```

SQL equivalent: `SELECT * FROM users`.

#### Specific Fields
To select specific fields, pass in an array of fields to the `.select()` method.

```js
const users = await db.prepare("users")
  .select(["name", "email"])
  .fetchAll();
```

SQL equivalent: `SELECT name, email FROM users`.

#### Order By
To sort results by a particular field, use the `.orderBy()` method.

```js
const users = await db.prepare("users")
  .select()
  .orderBy("age", "desc")
  .fetchAll();
```

SQL equivalent: `SELECT * FROM users ORDER BY age DESC`.

#### Limit
To limit the number of results returned, use the `.limit()` method.

```js
const users = await db.prepare("users")
  .select()
  .limit(10) // return first 10 records
  .fetchAll();
```

SQL equivalent: `SELECT * FROM users LIMIT 10`.

#### Offset
For paginated results, use `.offset()` after `.limit()`.

```js
const users = await db.prepare("users")
  .select()
  .limit(10)
  .offset(20) // skip first 20 records
  .fetchAll();
```

SQL equivalent: `SELECT * FROM users LIMIT 20, 10`.

#### Filtering Records
To simulate the `WHERE` clause of a `SELECT` SQL statement, use the `.where()` method. By default, nested arrays are concatenated with `AND`.

```js
const users = await db.prepare("users")
  .select()
  .where([  // by default, conditions are connected with "AND"
      ["age", ">=", 18],
      ["status", "=", "active"]
  ])
  .fetchAll();
```

This is the equivalent of the SQL statement: `SELECT * FROM users WHERE age >= 18 AND status = "active"`.

#### Mixed AND/OR Conditions
Using a mix of `AND` and `OR` conditions, you can set up complex queries. Each array element is concatenated with `AND`, while anything inside of an `OR` array are concatenated with `OR`.

```js
const users = await db.prepare("users")
  .select()
  .where([  // conditions in flat arrays are connected with "AND" by default
    ["age", ">=", 18],
    ["status", "=", "active"],
    {
      OR: [  // connect conditions inside here with "OR"
        ["membership", "=", "gold"],
        ["membership", "=", "platinum"]
      ]
    }
  ])
  .fetchAll();
```

The SQL equivalent of this would be: `SELECT * FROM users WHERE age >= 18 AND status = "active" AND (membership = "gold" OR membership = "platinum")`.

#### Nested AND/OR Conditions
Finally, you can nest `AND` and `OR` conditions for even more complex queries.

```js
const users = await db.prepare("users")
  .select()
  .where([
    {
      AND: [  // explicitly connect each condition inside with "AND"
        ["role", "=", "admin"],
        {
          OR: [  // connect each condition inside with "OR"
            ["department", "=", "IT"],
            ["department", "=", "HR"]
          ]
        }
      ]
    }
  ])
  .fetchAll();
```

In this case, the `AND` is explicitly set. The SQL equivalent of this would be: `SELECT * FROM users WHERE (role = "admin AND (department = "IT" OR department = "HR"))`.

#### Full Pagination Example
```js
const users = await db.prepare("users")
  .select()
  .where(["status", "=", "active"])  // select records where status="active"...
  .orderBy("name", "asc")            // ...sorted by name, ascending (i.e. A-Z)
  .limit(5)                          // only select the first 5 records...
  .offset(10)                        // ...starting with the 11th record (i.e. skipping 10)
  .fetchAll();
```

SQL equivalent: `SELECT * FROM users WHERE status = "active" ORDER BY name ASC LIMIT 10, 5`.

## Coming Soon
Planned features for future release versions:
* Optimize performance with `indexedDB` *indexes*.
* Add aggregate functions: `.count()`, `.sum()`, `.avg()`, `.min()`, `.max()`.
* Grouping with conditions: `.groupBy()`, `.having()`.
* Fuzzy searching across text fields: `search(field, keyword)`.
* Subqueries (e.g. `.where([ "id", "IN", db.prepare("orders").select("user_id").fetchAll() ])`)
  * *This could be accomplished by manually nesting queries (i.e. returning the results of one before using them in another) for now.*
* Bulk insert: `.insertMany()`.
* Transactional queries, ensuring multiple operations succeed or fail together (ACID compliance).
* Schema management: `.createTable()`, `dropTable()`, `.alterTable()`.
* Query caching & memorization, storing results to avoid redundant indexedDB calls: `.cache()`.
* Data import and export: `.import()`, `.export()`.
* User roles and permissions: `.withRole()`.
* Various performance optimizations.

## Changelog
### Version 1.0
Basic functionality:
* Select
* Insert
* Update
* Delete
* Where (with AND/OR)
* Order By
* Limit
* Offset
