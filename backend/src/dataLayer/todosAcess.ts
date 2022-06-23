import * as AWS from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { createLogger } from '../utils/logger'
import { TodoItem } from '../models/TodoItem'
import { TodoUpdate } from '../models/TodoUpdate';

const XAWS = AWSXRay.captureAWS(AWS)

const logger = createLogger('TodosAccess')

// TODO: Implement the dataLayer logic
export class TodosAccess {
  constructor(
    private readonly docClient: DocumentClient = createDynamoDBClient(),
    private readonly todoTable = process.env.TODOS_TABLE,
    private readonly todoIndex = process.env.TODOS_CREATED_AT_INDEX,
    private readonly bucketName = process.env.ATTACHMENT_S3_BUCKET,
    private readonly urlExpiration = process.env.S3_URL_EXPIRATION,
    private readonly s3 = new XAWS.S3({
      signatureVersion: "v4",
    })
  ) {}

  async getTodosForUser(userId: String): Promise<any> {
    console.log('Getting all todos of userId: ', userId)
    
    const result = await this.docClient
      .query({
        TableName: this.todoTable,
        IndexName: this.todoIndex,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
      .promise();
    const items = result.Items

    logger.info("Get all todo", {
      userId: userId,
      items: JSON.stringify(items),
      date: new Date().toISOString
    })
    return items as TodoItem[];
  }

  async createTodo(todo: TodoItem): Promise<TodoItem> {
    console.log('Creating a new todo: ', todo)

    this.docClient
      .put({
        TableName: this.todoTable,
        Item: todo,
      })
      .promise();

    logger.info("Create a new todo", {
      userId: todo.userId,
      todoId: todo.todoId,
      date: new Date().toISOString
    })
    return todo;
  }

  async updateTodo(
    todoId: String,
    updatedTodo: TodoUpdate,
    userId: String
  ): Promise<TodoUpdate> {
    console.log("Updating todoId: ", todoId, " userId: ", userId);

    this.docClient.update(
      {
        TableName: this.todoTable,
        Key: {
          todoId,
          userId,
        },
        UpdateExpression: "set #name = :n, #dueDate = :due, #done = :d",
        ExpressionAttributeValues: {
          ":n": updatedTodo.name,
          ":due": updatedTodo.dueDate,
          ":d": updatedTodo.done,
        },
        ExpressionAttributeNames: {
          "#name": "name",
          "#dueDate": "dueDate",
          "#done": "done",
        },
      },
      function (err, data) {
        if (err) {
          console.log("ERRROR " + err);
          throw new Error("Error " + err);
        } else {
          console.log("Element updated " + data);
        }
      }
    );
    logger.info("Update a todo", {
      userId: userId,
      todoId: todoId,
      date: new Date().toISOString
    })
    return updatedTodo
  }

  async deleteTodo(todoId: String, userId: String): Promise<void> {
    console.log("Deleting todoId: ", todoId, " userId: ", userId);
    
    this.docClient.delete(
      {
        TableName: this.todoTable,
        Key: {
          todoId,
          userId,
        },
      },
      function (err, data) {
        if (err) {
          console.log("ERRROR " + err);
          throw new Error("Error " + err);
        } else {
          console.log("Element deleted " + data);
        }
      }
    );
    logger.info("Delete a todo", {
      userId: userId,
      todoId: todoId,
      date: new Date().toISOString
    })
  }

  async createAttachmentPresignedUrl(
    todoId: String,
    imageId: String,
    userId: String
  ): Promise<string> {
    const attachmentUrl = await this.s3.getSignedUrl("putObject", {
      Bucket: this.bucketName,
      Key: imageId,
      Expires: this.urlExpiration,
    });

    this.docClient.update(
      {
        TableName: this.todoTable,
        Key: {
          todoId,
          userId,
        },
        UpdateExpression: "set attachmentUrl = :attachmentUrl",
        ExpressionAttributeValues: {
          ":attachmentUrl": `https://${this.bucketName}.s3.amazonaws.com/${imageId}`,
        },
      },
      function (err, data) {
        if (err) {
          console.log("ERRROR " + err);
          throw new Error("Error " + err);
        } else {
          console.log("Element updated " + data);
        }
      }
    );
    logger.info("Creata a signedUrl", {
      userId: userId,
      todoId: todoId,
      date: new Date().toISOString
    })
    return attachmentUrl;
  }
}

function createDynamoDBClient() {
  if (process.env.IS_OFFLINE) {
    console.log("Creating a local DynamoDB instance");
    return new XAWS.DynamoDB.DocumentClient({
      region: "localhost",
      endpoint: "http://localhost:8000",
    });
  }

  return new XAWS.DynamoDB.DocumentClient();
}