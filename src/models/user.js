const { Model, DataTypes } = require('sequelize')
const Sequelize = require('../database')

class User extends Model { }

User.init({
    name: DataTypes.STRING,
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    role: DataTypes.STRING,
}, { sequelize: Sequelize, modelName: 'user' })

module.exports = User