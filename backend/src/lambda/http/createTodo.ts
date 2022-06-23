import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import 'source-map-support/register'
import * as middy from 'middy'
import { cors } from 'middy/middlewares'
import * as uuid from "uuid";
import { CreateTodoRequest } from '../../requests/CreateTodoRequest'
import { getUserId, sendMessageToAllClient } from '../utils';
import { createTodo } from '../../businessLogic/todos'

export const handler = middy(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const todoRequest: CreateTodoRequest = JSON.parse(event.body)
    // TODO: Implement creating a new TODO item
    const userId = getUserId(event)
    const todoId = uuid.v4()

    const newTodo = await createTodo(todoId, todoRequest, userId)
    sendMessageToAllClient(`UserId ${userId} has just created a new todo`)
    return {
      statusCode: 201,
      body: JSON.stringify({
        item: newTodo,
      }),
    }
  }
)

handler.use(
  cors({
    credentials: true
  })
)
