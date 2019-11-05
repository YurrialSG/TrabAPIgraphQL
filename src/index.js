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
        time_registered: String
        user: [User]
    }

    type Query {
        allUsers: [User]
        allRegistered_times: [Registered_time]
    }

    type Mutation {
        createUser(data: CreateUserInput): User
        deleteUser(id: ID!): Boolean
    }

    input CreateUserInput {
        name: String!
        email: String!
        password: String!
        role: RoleEnum!
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
        async createUser(parent, body, context, info) {
            body.data.password = await bcrypt.hash(body.data.password, 10)
            const user = await User.create(body.data)
            const reloadedUser = user.reload({ include: [Registered_time] })
            pubSub.publish('createdUser', {
                onCreatedUser: reloadedUser
            })
            return reloadedUser
        },
        async deleteUser(parent, body, context, info) {
            const user = await User.findOne({
                where: { id: body.id }
            })
            await user.destroy()
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