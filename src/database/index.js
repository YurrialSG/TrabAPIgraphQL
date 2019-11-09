const { Sequelize } = require('sequelize')
//para publicar no heroku tem que mudar as configurações daki
module.exports = new Sequelize({
    dialect: 'sqlite',
    storage: './db.sqlite',
    logging: true
})