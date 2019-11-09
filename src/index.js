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
        ADMINISTRADOR
        PROFISSIONAL
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
        allUsers: [User] @auth(role: ADMINISTRADOR)
        allRegistered_times(id: ID): [Registered_time]
    }

    type Mutation {
        createUser(data: CreateUserInput): User
        updateUser(id: ID! data: UpdateUserInput): User
        deleteUser(id: ID!): Boolean

        createRegistered_time(data: CreateRegistered_timeInput): Registered_time @auth(role: PROFISSIONAL)
        updateRegistered_time(id: ID! data: UpdateRegistered_timeInput): Registered_time
        deleteRegistered_time(id: ID!): Boolean

        signin(
            email: String!
            password: String!
        ): PayloadAuth
    }

    type PayloadAuth {
        token: String!
        user: User!
    }

    type Subscription {
        onCreateRegistereds: Registered_time
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
        user: createTimerUserInput
    }

    input createTimerUserInput {
        id: ID!
    }

    input UpdateRegistered_timeInput {
        time_registered: String
    }

`

const resolver = {
    Query: {
        allUsers() {
            const findUser = User.findAll({ include: [Registered_time] })
            return findUser
        },
        async allRegistered_times(parent, body, context, info) {
            if(context.userId){
                if(context.roleId !== 'ADMINISTRADOR'){
                    const registersID = await Registered_time.findAll({
                        where: { userId: context.userId },
                        include: [User]
                    })
                    if(!registersID) {
                        throw new Error('Usuário não encontrado')
                    }
                    return registersID
                }
            }
            return Registered_time.findAll({ include: [User] })
        }
    },
    Mutation: {
        //gerenciar user
        async createUser(parent, body, context, info) {
            body.data.password = await bcrypt.hash(body.data.password, 10)
            const user = await User.create(body.data)
            const reloadedUser = user.reload({ include: [Registered_time] })
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
            if(!user) {
                throw new Error('Usuário não encontrado')
            }
            await user.destroy()
            return true
        },
        //gerenciar registered_time
        async createRegistered_time(parent, body, context, info) {
            if(body.data.user) {
            const registered_time = await Registered_time.create(body.data)
            await registered_time.setUser(body.data.user.id)
            const reloadedUser = registered_time.reload({ include: [User] })
            pubSub.publish('createRegistered', {
                onCreateRegistereds: reloadedUser
            })
            return reloadedUser
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
            if(!registered_time) {
                throw new Error('Registro não encontrado')
            }
            await registered_time.destroy()
            return true
        },
        //fazer login de user
        async signin(parent, body, context, info) {
            const user = await User.findOne({
                where: { email: body.email }
            })
            
            if(user) {
                const isCorrect = await bcrypt.compare(body.password, user.password)
                if(!isCorrect) {
                    throw new Error('Senha inválida')
                }
                const token = jwt.sign({ id: user.id }, 'secret')
                
                return {
                    token,
                    user
                }
            }
        }
    },
    Subscription: {
        onCreateRegistereds: {
            subscribe: () => pubSub.asyncIterator('createRegistered')
        }
    }
}

const server = new ApolloServer({
    typeDefs: typeDefs,
    resolvers: resolver,
    schemaDirectives: {
        auth: AuthDirective
    },
    //context: ({ req, res }) => ({req, res})
    async context({ req, connection }) {
        if (connection) {
            return connection.context
        }
        const token = req.headers.authorization
        //console.log(token)

        if(token){
            const jwtData = jwt.decode(token.replace('Bearer ', ''))
            const { id } = jwtData

            const user = await User.findOne({
                where: { id }
            })

            return {
                headers: req.headers,
                userId: id,
                roleId: user.role
            }
        }

        return {
            headers: req.headers,
        }
    }
});


Sequelize.sync().then(() => {
    server.listen()
        .then(() => {
            console.log('Servidor rodando')
        })
})