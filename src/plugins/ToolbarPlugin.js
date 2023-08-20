import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  FORMAT_TEXT_COMMAND,
  $getSelection,
  $isRangeSelection,
  INSERT_PARAGRAPH_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_DOWN_COMMAND,
} from "lexical";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {  $isAtNodeEnd } from "@lexical/selection";
import { $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode,
} from "@lexical/list";
import { createPortal } from "react-dom";
import { $isHeadingNode } from "@lexical/rich-text";

const LowPriority = 1;

function Divider() {
  return <div className="divider" />;
}

function positionEditorElement(editor, rect) {
  if (rect === null) {
    editor.style.opacity = "0";
    editor.style.top = "-1000px";
    editor.style.left = "-1000px";
  } else {
    editor.style.opacity = "1";
    editor.style.top = `${rect.top + rect.height + window.pageYOffset + 10}px`;
    editor.style.left = `${
      rect.left + window.pageXOffset - editor.offsetWidth / 2 + rect.width / 2
    }px`;
  }
}

function FloatingLinkEditor({ editor }) {
  const editorRef = useRef(null);
  const inputRef = useRef(null);
  const mouseDownRef = useRef(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [isEditMode, setEditMode] = useState(false);
  const [lastSelection, setLastSelection] = useState(null);

  const updateLinkEditor = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection);
      const parent = node.getParent();
      if ($isLinkNode(parent)) {
        setLinkUrl(parent.getURL());
      } else if ($isLinkNode(node)) {
        setLinkUrl(node.getURL());
      } else {
        setLinkUrl("");
      }
    }
    const editorElem = editorRef.current;
    const nativeSelection = window.getSelection();
    const activeElement = document.activeElement;

    if (editorElem === null) {
      return;
    }

    const rootElement = editor.getRootElement();
    if (
      selection !== null &&
      !nativeSelection.isCollapsed &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      const domRange = nativeSelection.getRangeAt(0);
      let rect;
      if (nativeSelection.anchorNode === rootElement) {
        let inner = rootElement;
        while (inner.firstElementChild != null) {
          inner = inner.firstElementChild;
        }
        rect = inner.getBoundingClientRect();
      } else {
        rect = domRange.getBoundingClientRect();
      }

      if (!mouseDownRef.current) {
        positionEditorElement(editorElem, rect);
      }
      setLastSelection(selection);
    } else if (!activeElement || activeElement.className !== "link-input") {
      positionEditorElement(editorElem, null);
      setLastSelection(null);
      setEditMode(false);
      setLinkUrl("");
    }

    return true;
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateLinkEditor();
        });
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateLinkEditor();
          return true;
        },
        LowPriority
      )
    );
  }, [editor, updateLinkEditor]);

  useEffect(() => {
    editor.getEditorState().read(() => {
      updateLinkEditor();
    });
  }, [editor, updateLinkEditor]);

  useEffect(() => {
    if (isEditMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditMode]);

  return (
    <div ref={editorRef} className="link-editor">
      {isEditMode ? (
        <input
          ref={inputRef}
          className="link-input"
          value={linkUrl}
          onChange={(event) => {
            setLinkUrl(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (lastSelection !== null) {
                if (linkUrl !== "") {
                  editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl);
                }
                setEditMode(false);
              }
            } else if (event.key === "Escape") {
              event.preventDefault();
              setEditMode(false);
            }
          }}
        />
      ) : (
        <>
          <div className="link-input">
            <a href={linkUrl} target="_blank" rel="noopener noreferrer">
              {linkUrl}
            </a>
            <div
              className="link-edit"
              role="button"
              tabIndex={0}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setEditMode(true);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function getSelectedNode(selection) {
  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorNode = selection.anchor.getNode();
  const focusNode = selection.focus.getNode();
  if (anchorNode === focusNode) {
    return anchorNode;
  }
  const isBackward = selection.isBackward();
  if (isBackward) {
    return $isAtNodeEnd(focus) ? anchorNode : focusNode;
  } else {
    return $isAtNodeEnd(anchor) ? focusNode : anchorNode;
  }
}

export default function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [blockType, setBlockType] = useState("paragraph");
  const [isLink, setIsLink] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isOl, setIsOl] = useState(false);
  const [isUl, setIsUl] = useState(false);
  const [isShiftEnterBreakline, setIsShiftEnterBreakline] = useState(true);
  const [isEnterBreakline, setIsEnterBreakline] = useState(false);
  const [isCtrlEnterBreakline, setIsCtrlEnterBreakline] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === "root"
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);
      if (elementDOM !== null) {
        // setSelectedElementKey(elementKey);
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode);
          const type = parentList ? parentList.getTag() : element.getTag();
          setBlockType(type);
        } else {
          const type = $isHeadingNode(element)
            ? element.getTag()
            : element.getType();
          setBlockType(type);
        }
      }
      // Update text format
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrikethrough(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));
      setIsOl(selection.hasFormat("ol"));
      setIsUl(selection.hasFormat("ul"));

      // Update links
      const node = getSelectedNode(selection);
      const parent = node.getParent();
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        setIsLink(true);
      } else {
        setIsLink(false);
      }
    }
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, newEditor) => {
          updateToolbar();
          return false;
        },
        LowPriority
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        LowPriority
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        LowPriority
      )
    );
  }, [editor, updateToolbar]);

  // disabled line break when pressing enter
  useEffect(() => {
    editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (!isEnterBreakline && event.key === "Enter") {
          event.preventDefault();
        }
        if (isShiftEnterBreakline && event.shiftKey && event.key === "Enter") {
          event.preventDefault();
          editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
        }
        if (isCtrlEnterBreakline && event.ctrlKey && event.key === "Enter") {
          event.preventDefault();
          editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
        }
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  // useEffect(() => {
  //   editor.setEditable(false)
  // }, [editor]);

  // editor.update(() => {
  //   $getRoot().clear();
  // })

  const insertLink = useCallback(() => {
    if (!isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor, isLink]);

  const formattingActions = [
    { command: "undo", icon: "format undo", state: canUndo, label: "Undo" },
    { command: "redo", icon: "format redo", state: canRedo, label: "Redo" },
    { command: "bold", icon: "format bold", state: isBold, label: "Bold" },
    {
      command: "italic",
      icon: "format italic",
      state: isItalic,
      label: "Italics",
    },
    {
      command: "underline",
      icon: "format underline",
      state: isUnderline,
      label: "Underline",
    },
    {
      command: "strikethrough",
      icon: "format strikethrough",
      state: isStrikethrough,
      label: "Strikethrough",
    },
    { command: "link", icon: "format link", state: isLink, label: "Link" },
    { command: "code", icon: "format code", state: isCode, label: "Code" },
    { command: "ol", icon: "format ol", state: isOl, label: "Ordered List" },
    { command: "ul", icon: "format ul", state: isUl, label: "Unordered List" },
  ];

  return (
    <div className="toolbar" ref={toolbarRef}>
      {formattingActions.map((action) => (
        <button
          key={action.command}
          onClick={() => {
            if (action.command === "ul") {
              if (blockType !== "ul") {
                editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND);
              } else {
                editor.dispatchCommand(REMOVE_LIST_COMMAND);
              }
            } else if (action.command === "ol") {
              if (blockType !== "ol") {
                editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND);
              } else {
                editor.dispatchCommand(REMOVE_LIST_COMMAND);
              }
            } else if (action.command === "link") {
              insertLink();
            } else if (action.command === "redo") {
              editor.dispatchCommand(REDO_COMMAND);
            } else if (action.command === "undo") {
              editor.dispatchCommand(UNDO_COMMAND);
            } else {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, action.command);
            }
          }}
          className={`toolbar-item spaced ${action.state ? "active" : ""}`}
          aria-label={`Format ${action.label}`}
          disabled={
            (action.command === "redo" && !canRedo) ||
            (action.command === "undo" && !canUndo)
          }
        >
          <i className={action.icon} />
        </button>
      ))}
      {isLink &&
        createPortal(<FloatingLinkEditor editor={editor} />, document.body)}
    </div>
  );
}
