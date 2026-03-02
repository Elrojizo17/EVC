export default function FormSelect({ 
  label, 
  name, 
  value, 
  onChange, 
  onBlur, 
  error, 
  touched,
  required = false,
  disabled = false,
  children,
  ...rest 
}) {
  const hasError = touched && error;

  return (
    <div style={{ marginBottom: "15px" }}>
      <label style={{
        display: "block",
        marginBottom: "6px",
        fontSize: "13px",
        fontWeight: "500",
        color: "#334155"
      }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: "14px",
          border: hasError ? "2px solid #ef4444" : "1px solid #e2e8f0",
          borderRadius: "6px",
          outline: "none",
          transition: "all 0.2s",
          backgroundColor: disabled ? "#f8fafc" : "white",
          boxShadow: hasError ? "0 0 0 3px rgba(239, 68, 68, 0.1)" : "none",
          cursor: disabled ? "not-allowed" : "pointer"
        }}
        onFocus={(e) => {
          if (!hasError) {
            e.target.style.borderColor = "#0f7c90";
            e.target.style.boxShadow = "0 0 0 3px rgba(15, 124, 144, 0.1)";
          }
        }}
        onBlurCapture={(e) => {
          if (!hasError) {
            e.target.style.borderColor = "#e2e8f0";
            e.target.style.boxShadow = "none";
          }
        }}
        {...rest}
      >
        {children}
      </select>
      {hasError && (
        <div style={{
          marginTop: "6px",
          fontSize: "12px",
          color: "#ef4444",
          display: "flex",
          alignItems: "center",
          gap: "4px"
        }}>
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
