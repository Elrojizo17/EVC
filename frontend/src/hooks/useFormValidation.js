import { useState, useCallback } from 'react';

export const useFormValidation = (initialValues, validationRules) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validate = useCallback((fieldName, value) => {
    const rules = validationRules[fieldName];
    if (!rules) return '';

    for (const rule of rules) {
      const error = rule(value, values);
      if (error) return error;
    }
    return '';
  }, [validationRules, values]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));

    // Validar solo si el campo ya fue tocado
    if (touched[name]) {
      const error = validate(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [touched, validate]);

  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const error = validate(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  }, [validate]);

  const validateAll = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach(fieldName => {
      const error = validate(fieldName, values[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    setTouched(Object.keys(validationRules).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {}));

    return isValid;
  }, [validate, validationRules, values]);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    resetForm,
    setValues
  };
};

// Reglas de validación comunes
export const validationRules = {
  required: (value) => {
    if (!value || String(value).trim() === '') {
      return 'Este campo es requerido';
    }
    return '';
  },

  minLength: (min) => (value) => {
    if (value && String(value).length < min) {
      return `Debe tener al menos ${min} caracteres`;
    }
    return '';
  },

  maxLength: (max) => (value) => {
    if (value && String(value).length > max) {
      return `No debe exceder ${max} caracteres`;
    }
    return '';
  },

  number: (value) => {
    if (value && isNaN(Number(value))) {
      return 'Debe ser un número válido';
    }
    return '';
  },

  positiveNumber: (value) => {
    if (value && Number(value) <= 0) {
      return 'Debe ser un número positivo';
    }
    return '';
  },

  min: (minValue) => (value) => {
    if (value && Number(value) < minValue) {
      return `El valor mínimo es ${minValue}`;
    }
    return '';
  },

  max: (maxValue) => (value) => {
    if (value && Number(value) > maxValue) {
      return `El valor máximo es ${maxValue}`;
    }
    return '';
  },

  email: (value) => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Email inválido';
    }
    return '';
  },

  alphanumeric: (value) => {
    if (value && !/^[a-zA-Z0-9_-]+$/.test(value)) {
      return 'Solo letras, números, guiones y guiones bajos';
    }
    return '';
  },

  pattern: (regex, message) => (value) => {
    if (value && !regex.test(value)) {
      return message || 'Formato inválido';
    }
    return '';
  }
};
