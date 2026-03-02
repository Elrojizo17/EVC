export default function FormInput({ 
  label, 
  name, 
  type = "text", 
  value, 
  onChange, 
  onBlur, 
  error, 
  touched,
  required = false,
  placeholder = "",
  disabled = false,
  small = false,
  ...rest 
}) {
  const hasError = touched && error;

  return (
    <div style={{ marginBottom: small ? "10px" : "15px" }}>
      <label style={{
        display: "block",
        marginBottom: small ? "4px" : "6px",
        fontSize: small ? "12px" : "13px",
        fontWeight: "500",
        color: "#334155"
      }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          padding: small ? "7px 10px" : "10px 12px",
          fontSize: small ? "13px" : "14px",
          border: hasError ? "2px solid #ef4444" : "1px solid #e2e8f0",
          borderRadius: "6px",
          outline: "none",
          transition: "all 0.2s",
          backgroundColor: disabled ? "#f8fafc" : "white",
          boxShadow: hasError ? "0 0 0 3px rgba(239, 68, 68, 0.1)" : "none"
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
      />
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
