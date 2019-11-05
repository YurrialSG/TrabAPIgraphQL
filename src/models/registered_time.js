const { Model, DataTypes } = require('sequelize')
const Sequelize = require('../database')
const User = require('./user')

class Registered_time extends Model { 
    static associate() {
        User.hasMany(Registered_time)
        Registered_time.belongsTo(User)
    }
}

Registered_time.init({
    time_registered: DataTypes.DATE
}, { sequelize: Sequelize, modelName: 'registered_time' })

Registered_time.associate()

module.exports = Registered_time