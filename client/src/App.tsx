import "./App.css";
import { ChatPanel, KnowledgeHub } from "./components";

function App() {
  return (
    <div className="main-container">
      <KnowledgeHub />
      <ChatPanel />
    </div>
  );
}

export default App;
