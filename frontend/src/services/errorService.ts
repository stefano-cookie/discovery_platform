export interface ErrorDetails {
  code?: string;
  field?: string;
  message: string;
  type: 'error' | 'warning' | 'info';
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export class ErrorService {
  // Map common error codes to user-friendly messages
  private static errorMessages: Record<string, string> = {
    // Authentication errors
    'AUTH_INVALID_CREDENTIALS': 'Email o password non corretti',
    'AUTH_ACCOUNT_LOCKED': 'Account temporaneamente bloccato per troppi tentativi falliti',
    'AUTH_TOKEN_EXPIRED': 'Sessione scaduta, effettua nuovamente il login',
    'AUTH_INSUFFICIENT_PERMISSIONS': 'Non hai i permessi necessari per questa operazione',
    
    // Validation errors
    'VALIDATION_EMAIL_INVALID': 'Formato email non valido',
    'VALIDATION_EMAIL_REQUIRED': 'Email è obbligatoria',
    'VALIDATION_PASSWORD_WEAK': 'La password deve contenere almeno 8 caratteri, una maiuscola, una minuscola e un numero',
    'VALIDATION_PASSWORD_REQUIRED': 'Password è obbligatoria',
    'VALIDATION_REQUIRED_FIELD': 'Questo campo è obbligatorio',
    'VALIDATION_CODICE_FISCALE_INVALID': 'Codice fiscale non valido',
    'VALIDATION_PHONE_INVALID': 'Numero di telefono non valido',
    
    // Registration errors
    'REGISTRATION_EMAIL_EXISTS': 'Esiste già un account con questa email',
    'REGISTRATION_FAILED': 'Errore durante la registrazione, riprova più tardi',
    'REGISTRATION_INVALID_REFERRAL': 'Codice referral non valido',
    
    // Server errors
    'SERVER_ERROR': 'Errore interno del server, riprova più tardi',
    'NETWORK_ERROR': 'Errore di connessione, controlla la tua connessione internet',
    'TIMEOUT_ERROR': 'Timeout della richiesta, riprova più tardi',
    
    // Generic errors
    'UNKNOWN_ERROR': 'Si è verificato un errore imprevisto'
  };

  // Process API error response
  static processApiError(error: any): ErrorDetails {
    // Network or connection errors
    if (!error.response) {
      return {
        code: 'NETWORK_ERROR',
        message: this.errorMessages['NETWORK_ERROR'],
        type: 'error'
      };
    }

    const { status, data } = error.response;

    // Handle specific HTTP status codes
    switch (status) {
      case 400:
        return this.processBadRequestError(data);
      case 401:
        return {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: data?.error || this.errorMessages['AUTH_INVALID_CREDENTIALS'],
          type: 'error'
        };
      case 403:
        return {
          code: 'AUTH_INSUFFICIENT_PERMISSIONS',
          message: this.errorMessages['AUTH_INSUFFICIENT_PERMISSIONS'],
          type: 'error'
        };
      case 422:
        return this.processValidationError(data);
      case 500:
        return {
          code: 'SERVER_ERROR',
          message: this.errorMessages['SERVER_ERROR'],
          type: 'error'
        };
      default:
        return {
          code: 'UNKNOWN_ERROR',
          message: data?.error || this.errorMessages['UNKNOWN_ERROR'],
          type: 'error'
        };
    }
  }

  // Process validation errors (422)
  private static processValidationError(data: any): ErrorDetails {
    if (data?.errors && Array.isArray(data.errors)) {
      // Multiple validation errors - return the first one
      const firstError = data.errors[0];
      return {
        code: firstError.code || 'VALIDATION_ERROR',
        field: firstError.field,
        message: firstError.message || 'Errore di validazione',
        type: 'error'
      };
    }

    return {
      code: 'VALIDATION_ERROR',
      message: data?.error || 'Errore di validazione',
      type: 'error'
    };
  }

  // Process bad request errors (400)
  private static processBadRequestError(data: any): ErrorDetails {
    const errorMessage = data?.error || 'Richiesta non valida';
    
    // Try to map known error messages to codes
    for (const [code, message] of Object.entries(this.errorMessages)) {
      if (errorMessage.toLowerCase().includes(message.toLowerCase()) ||
          errorMessage.toLowerCase().includes(code.toLowerCase().replace('_', ' '))) {
        return {
          code,
          message: this.errorMessages[code],
          type: 'error'
        };
      }
    }

    return {
      message: errorMessage,
      type: 'error'
    };
  }

  // Validate form fields
  static validateField(fieldName: string, value: any, rules: any = {}): ValidationError | null {
    // Required field validation
    if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return {
        field: fieldName,
        code: 'VALIDATION_REQUIRED_FIELD',
        message: this.errorMessages['VALIDATION_REQUIRED_FIELD']
      };
    }

    // Email validation
    if (fieldName === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return {
          field: fieldName,
          code: 'VALIDATION_EMAIL_INVALID',
          message: this.errorMessages['VALIDATION_EMAIL_INVALID']
        };
      }
    }

    // Password validation - only apply complex validation for registration context
    if (fieldName === 'password' && value && rules.context === 'registration') {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&;.]{8,}$/;
      if (!passwordRegex.test(value)) {
        return {
          field: fieldName,
          code: 'VALIDATION_PASSWORD_WEAK',
          message: this.errorMessages['VALIDATION_PASSWORD_WEAK']
        };
      }
    }

    // Phone validation (basic Italian format)
    if (fieldName === 'telefono' && value) {
      const phoneRegex = /^[+]?[0-9\s-()]{8,15}$/;
      if (!phoneRegex.test(value)) {
        return {
          field: fieldName,
          code: 'VALIDATION_PHONE_INVALID',
          message: this.errorMessages['VALIDATION_PHONE_INVALID']
        };
      }
    }

    return null;
  }

  // Get user-friendly message for error code
  static getErrorMessage(code: string): string {
    return this.errorMessages[code] || this.errorMessages['UNKNOWN_ERROR'];
  }

  // Check if error is recoverable (user can retry)
  static isRecoverableError(error: ErrorDetails): boolean {
    const nonRecoverableCodes = [
      'AUTH_INSUFFICIENT_PERMISSIONS',
      'REGISTRATION_EMAIL_EXISTS',
      'VALIDATION_EMAIL_INVALID',
      'VALIDATION_CODICE_FISCALE_INVALID'
    ];

    return error.code ? !nonRecoverableCodes.includes(error.code) : true;
  }
}

export default ErrorService;