"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const pool = new pg_1.Pool();
exports.default = {
    query: (text, params) => {
        return pool.query(text, params);
    },
};
