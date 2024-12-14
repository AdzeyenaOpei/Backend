const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool ({
  connectionString : process.env.SUPABASE_URI,
  ssl: {
    rejectUnauthorized: false
  }
});  
 
pool.connect().then(()=> console.log(`Connected to Database`)).catch(err=>console.log(err))
module.exports = pool;
