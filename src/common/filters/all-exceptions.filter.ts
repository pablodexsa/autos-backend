import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Error interno del servidor';
    let details: any = null;

    if (exception instanceof HttpException) {
      const res: any = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res.message === 'string') {
        message = res.message;
      } else if (Array.isArray(res.message)) {
        message = res.message.join(', ');
      }
      details = res;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      mensaje:
        message ||
        'Ocurrió un error inesperado. Intente nuevamente o contacte al administrador.',
      detalles: details,
      timestamp: new Date().toISOString(),
    });
  }
}
