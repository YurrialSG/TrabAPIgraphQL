const { SchemaDirectiveVisitor, AuthenticationError } = require('apollo-server')
const { defaultFieldResolver } = require('graphql')
const jwt = require('jsonwebtoken')
const User = require('../models/user')
class AuthDirective extends SchemaDirectiveVisitor {
    visitObject(type) {
        this.ensureFieldsWrapped(type)
        type._role = this.args.role
    }

    visitFieldDefinition(field, details) {
        this.ensureFieldsWrapped(details.objectType)
        field._role = this.args.role
    }

    ensureFieldsWrapped(objectType) {
        if (objectType._authFieldsWrapped) {
            return
        }
        objectType._authFieldsWrapped = true

        const fields = objectType.getFields()

        Object.values(fields).forEach(field => {
            const { resolve = defaultFieldResolver } = field

            field.resolve = async function (...args) {
                const requiredRole = field._role || objectType._role

                if (!requiredRole) {
                    return resolve.apply(this, args)
                }

                const context = args[2]
                const token = context.headers.authorization
                console.log(token)
                const jwtData = jwt.decode(token.replace('Bearer ', ''))

                const { id } = jwtData

                const user = await User.findOne({
                    where: { id }
                })

                if (user.role !== requiredRole) {
                    throw new AuthenticationError('Você não tem permissão')
                }

                return resolve.apply(this, args)
            }
        })


    }

}

module.exports = AuthDirective