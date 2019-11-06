const { ApolloServer, gql, PubSub } = require('apollo-server')
const Sequelize = require('./database')
const User = require('./models/user')
const Registered_time = require('./models/registered_time')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const AuthDirective = require('./directives/auth')

const pubSub = new PubSub()

const typeDefs = gql`

    enum RoleEnum {
        ADMIN
        USER
    }

    directive @auth(
        role: RoleEnum
    ) on OBJECT | FIELD_DEFINITION
    
    type User {
        id: ID!
        name: String!
        email: String!
        password: String!
        role: RoleEnum!
        registered_time: [Registered_time]
    }

    type Registered_time {
        id: ID!
        time_registered: String!
        user: User!
    }

    type Query {
        allUsers: [User]
        allRegistered_times: [Registered_time]
    }

    type Mutation {
        createUser(data: CreateUserInput): User
        updateUser(id: ID! data: UpdateUserInput): User
        deleteUser(id: ID!): Boolean

        createRegistered_time(data: CreateRegistered_timeInput): Registered_time
        updateRegistered_time(id: ID! data: UpdateRegistered_timeInput): Registered_time
        deleteRegistered_time(id: ID!): Boolean
    }

    input CreateUserInput {
        name: String!
        email: String!
        password: String!
        role: RoleEnum!
    }

    input UpdateUserInput {
        name: String
        email: String
        password: String
        role: RoleEnum
    }

    input CreateRegistered_timeInput {
        time_registered: String!
        user: CreateUserInput
    }

    input UpdateRegistered_timeInput {
        time_registered: String
    }

`

const resolver = {
    Query: {
        allUsers() {
            return User.findAll({ include: [Registered_time] })
        },
        allRegistered_times() {
            return Registered_time.findAll({ include: [User] })
        }
    },
    Mutation: {
        //gerenciar user +++++++++++++++++++++++++++++++++++++++++++++++++++++
        async createUser(parent, body, context, info) {
            body.data.password = await bcrypt.hash(body.data.password, 10)
            const user = await User.create(body.data)
            const reloadedUser = user.reload({ include: [Registered_time] })
            pubSub.publish('createdUser', {
                onCreatedUser: reloadedUser
            })
            return reloadedUser
        },
        async updateUser(oarent, body, context, info) {
            if(body.data.password) {
                body.data.password = await bcrypt.hash(body.data.password, 10)
            }
            const user = await User.findOne({
                where: { id: body.id }
            })
            if(!user) {
                throw new Error('Usuário não encontrado')
            }
            const updateUser = await user.update(body.data)
            return updateUser
        },
        async deleteUser(parent, body, context, info) {
            const user = await User.findOne({
                where: { id: body.id }
            })
            await user.destroy()
            return true
        },
        //gerenciar registered_time ++++++++++++++++++++++++++++++++++++++++++
        async createRegistered_time(parent, body, context, info) {
            if(body.data.user) {
                const [createdUser, created] =
                    await User.findOrCreate({ where: body.data.user })
            body.data.user = null
            const registered_time = await Registered_time.create(body.data)
            await registered_time.setUser(createdUser.get('id'))
            return registered_time.reload({ include: [User] })
            } else {
                return User.create(body.data, { include: [Registered_time] })
            }
        },
        async updateRegistered_time(parent, body, context, info) {
            const registered_time = await Registered_time.findOne({
                where: { id: body.id }
            })
            if(!registered_time) {
                throw new Error('Registro não encontrado')
            }
            const updatedRegistered_time = await registered_time.update(body.data)
            return updatedRegistered_time
        },
        async deleteRegistered_time(parent, body, context, info) {
            const registered_time = await Registered_time.findOne({
                where: { id: body.id }
            })
            await registered_time.destroy()
            return true
        }
    }
}

const server = new ApolloServer({
    typeDefs: typeDefs,
    resolvers: resolver,
    schemaDirectives: {
        auth: AuthDirective
    },
    context({ req }) {
        return {
            headers: req.headers
        }
    }
});


Sequelize.sync().then(() => {
    server.listen()
        .then(() => {
            console.log('Servidor rodando')
        })
})