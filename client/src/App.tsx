import "./App.css";
import { ChatPanel, KnowledgeHub } from "./components";

function App() {
  return (
    <div className="container">
      <div className="background-glow" />
      <header className="header">
        <div className="brand">
          <div className="brand-text">
            <span className="brand-title">RAG Demo</span>
          </div>
        </div>
      </header>
      <div className="grid">
        <ChatPanel />
        <KnowledgeHub />
      </div>
    </div>
  );
}

export default App;
