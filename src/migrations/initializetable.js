exports.up = async function (knex) {
    await knex.schema
        .raw(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`)
        .createTable('users', table => {
            table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            table.string('username').notNullable();
            table.string('discord_id').notNullable().unique();
            table.string('avatar').nullable();
            table.timestamps(true, true);
        });
};

exports.down = async function (knex) {
    await knex.schema
        .dropTableIfExists('users');
};