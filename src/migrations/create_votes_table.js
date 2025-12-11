exports.up = async function(knex) {
    await knex.schema.createTable('votes', table => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.integer('voting_period_id').notNullable().defaultTo(1);
        table.string('prerequisite').notNullable();
        table.timestamps(true, true);
        
        table.unique(['user_id', 'voting_period_id']);
    });
};

exports.down = async function(knex) {
    await knex.schema.dropTableIfExists('votes');
};