import { useState, useMemo } from "react";
import { useFormValidation, validationRules } from "../hooks/useFormValidation";
import { useNotification } from "../hooks/useNotification";
import { createElectricista } from "../api/electricistas.api";
import FormInput from "./FormInput";

export default function ElectristaForm({ onSuccess, onCancel }) {
    const { success, error: errorNotification } = useNotification();
    const [submitting, setSubmitting] = useState(false);

    const validations = useMemo(() => ({
        nombre: [
            validationRules.required,
            validationRules.minLength(3),
            validationRules.maxLength(100)
        ],
        documento: [
            validationRules.required,
            validationRules.minLength(5),
            validationRules.maxLength(30),
            validationRules.pattern(/^[0-9]+$/, "Solo números")
        ],
        telefono: [
            validationRules.maxLength(20),
            validationRules.pattern(/^[0-9+\-\s]*$/, "Solo números, espacios y + -")
        ]
    }), []);

    const {
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        validateAll,
        resetForm
    } = useFormValidation({
        nombre: "",
        documento: "",
        telefono: ""
    }, validations);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateAll()) {
            errorNotification("Por favor corrige los errores del formulario");
            return;
        }

        try {
            setSubmitting(true);
            const nuevo = await createElectricista({
                nombre: values.nombre.trim(),
                documento: values.documento.trim(),
                telefono: values.telefono ? values.telefono.trim() : null
            });

            success("Electricista creado correctamente");
            resetForm();

            if (onSuccess) {
                onSuccess(nuevo);
            }
        } catch (err) {
            const msg = err?.response?.data?.error || "Error al crear el electricista";
            errorNotification(msg);
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        resetForm();
        if (onCancel) {
            onCancel();
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{
            background: "white",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
            padding: "22px 24px 20px",
            marginTop: "14px",
            border: "1px solid #e5e7eb"
        }}>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "18px"
            }}>
                <div>
                    <h2 style={{
                        fontSize: "19px",
                        fontWeight: 700,
                        margin: 0,
                        color: "#0f172a"
                    }}>Nuevo electricista</h2>
                    <p style={{
                        margin: "6px 0 0",
                        fontSize: "13px",
                        color: "#6b7280"
                    }}>
                        Completa los datos básicos para poder asociarlo más adelante a novedades e inventario.
                    </p>
                </div>
                {onCancel && (
                    <button
                        type="button"
                        onClick={handleCancel}
                        aria-label="Cerrar formulario"
                        style={{
                            background: "#f9fafb",
                            border: "1px solid #e5e7eb",
                            color: "#64748b",
                            cursor: "pointer",
                            fontSize: "18px",
                            padding: "4px 10px",
                            borderRadius: "999px",
                            lineHeight: 1
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#eff6ff";
                            e.currentTarget.style.color = "#1d4ed8";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#f9fafb";
                            e.currentTarget.style.color = "#64748b";
                        }}
                    >
                        ×
                    </button>
                )}
            </div>

            <div style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
                gap: "16px 20px",
                alignItems: "flex-start"
            }}>
                <div>
                    <FormInput
                        label="Nombre completo"
                        name="nombre"
                        value={values.nombre}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={errors.nombre}
                        touched={touched.nombre}
                        placeholder="Ej: Juan Pérez"
                        disabled={submitting}
                        small
                        required
                    />
                </div>
                <div>
                    <FormInput
                        label="Documento"
                        name="documento"
                        value={values.documento}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={errors.documento}
                        touched={touched.documento}
                        placeholder="Número de identificación"
                        disabled={submitting}
                        small
                        required
                    />
                </div>
                <div>
                    <FormInput
                        label="Teléfono (opcional)"
                        name="telefono"
                        value={values.telefono}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={errors.telefono}
                        touched={touched.telefono}
                        placeholder="Ej: 300 000 0000"
                        disabled={submitting}
                        small
                    />
                </div>
            </div>

            <div style={{
                marginTop: "10px",
                paddingTop: "10px",
                borderTop: "1px dashed #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px"
            }}>
                <div style={{
                    fontSize: "11px",
                    color: "#6b7280",
                    lineHeight: 1.6
                }}>
                    <div>Los campos marcados con <span style={{ color: "#ef4444" }}>*</span> son obligatorios.</div>
                    <div>Los nuevos electricistas quedarán activos automáticamente y podrás asociarlos al inventario y novedades más adelante.</div>
                </div>

                <div style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px"
                }}>
                {onCancel && (
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={submitting}
                        style={{
                            padding: "10px 16px",
                            borderRadius: "8px",
                            border: "1px solid #e5e7eb",
                            background: "white",
                            color: "#374151",
                            cursor: submitting ? "not-allowed" : "pointer",
                            fontSize: "14px"
                        }}
                    >
                        Cancelar
                    </button>
                )}
                <button
                    type="submit"
                    disabled={submitting}
                    style={{
                        padding: "10px 18px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#10b981",
                        color: "white",
                        cursor: submitting ? "not-allowed" : "pointer",
                        fontWeight: "bold",
                        fontSize: "14px",
                        opacity: submitting ? 0.7 : 1,
                        boxShadow: "0 8px 18px rgba(16,185,129,0.35)"
                    }}
                >
                    {submitting ? "Guardando..." : "Guardar electricista"}
                </button>
                </div>
            </div>
        </form>
    );
}
