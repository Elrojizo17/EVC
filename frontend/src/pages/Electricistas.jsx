import BackButton from "../components/BackButton";
import ElectristaList from "../components/ElectristaList";

export default function Electricistas() {
    return (
        <div style={{
            minHeight: "100vh",
            background: "#f3f4f6",
            padding: "24px"
        }}>
            <div style={{
                maxWidth: "1200px",
                margin: "0 auto"
            }}>
                <BackButton />
                <div style={{
                    marginTop: "16px"
                }}>
                    <ElectristaList />
                </div>
            </div>
        </div>
    );
}
