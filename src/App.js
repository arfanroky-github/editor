import "./styles.css";
import Editor from "./Editor";
import { useState } from "react";

export default function App() {
  const [editorState, setEditorState] = useState();
  function onChange(editorState) {
    // Call toJSON on the EditorState object, which produces a serialization safe string

    // However, we still have a JavaScript object, so we need to convert it to an actual string with JSON.stringify
    setEditorState(editorState);
  }



  return (
    <div className="App">
      <h1>Rich Text Example</h1>
      <p>Note: this is an experimental build of Lexical</p>
      <Editor onChange={onChange} />
      <div className="other">
    
        <h2>Other Examples</h2>
        <ul>
          <li>
            <a
              href="https://codesandbox.io/s/lexical-plain-text-example-g932e"
              target="_blank"
              rel="noreferrer"
            >
              Plain text example
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
