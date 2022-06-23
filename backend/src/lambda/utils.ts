import { APIGatewayProxyEvent } from "aws-lambda";
import { parseUserId } from "../auth/utils";
import * as AWS  from 'aws-sdk'
import 'source-map-support/register'

const docClient = new AWS.DynamoDB.DocumentClient()

const connectionsTable = process.env.CONNECTIONS_TODO_TABLE
const stage = process.env.STAGE
const apiId = process.env.API_ID

const connectionParams = {
  apiVersion: "2018-11-29",
  endpoint: `${apiId}.execute-api.us-east-1.amazonaws.com/${stage}`
}

const apiGateway = new AWS.ApiGatewayManagementApi(connectionParams)

/**
 * Get a user id from an API Gateway event
 * @param event an event from API Gateway
 *
 * @returns a user id from a JWT token
 */
export function getUserId(event: APIGatewayProxyEvent): string {
  const authorization = event.headers.Authorization
  const split = authorization.split(' ')
  const jwtToken = split[1]

  return parseUserId(jwtToken)
}

export async function sendMessageToAllClient(payload) {
  const connections = await docClient.scan({
      TableName: connectionsTable
  }).promise()

  for (const connection of connections.Items) {
      const connectionId = connection.id
      await sendMessageToClient(connectionId, payload)
  }
}

export async function sendMessageToClient(connectionId, payload) {
  try {
    console.log('Sending message to a connection', connectionId)

    await apiGateway.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(payload),
    }).promise()

  } catch (e) {
    console.log('Failed to send message', JSON.stringify(e))
    if (e.statusCode === 410) {
      console.log('Stale connection')

      await docClient.delete({
        TableName: connectionsTable,
        Key: {
          id: connectionId
        }
      }).promise()
    }
  }
}