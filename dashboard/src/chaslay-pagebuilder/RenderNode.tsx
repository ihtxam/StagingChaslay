// @ts-nocheck
'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { useNode, useEditor } from '@craftjs/core';
import { Move, Trash2, ArrowUp } from 'lucide-react';
import ReactDOM from 'react-dom';

interface RenderNodeProps {
  render: React.ReactElement;
}

export const RenderNode: React.FC<RenderNodeProps> = ({ render }) => {
  const { id } = useNode();
  const { actions, query, isActive } = useEditor((_, query) => ({
    isActive: query.getEvent('selected').contains(id),
  }));

  const {
    isHover,
    dom,
    name,
    moveable,
    deletable,
    connectors: { drag },
    parent,
  } = useNode((node) => ({
    isHover: node.events.hovered,
    dom: node.dom,
    name: node.data.custom?.displayName || node.data.displayName,
    moveable: query.node(node.id).isDraggable(),
    deletable: query.node(node.id).isDeletable(),
    parent: node.data.parent,
  }));

  const currentRef = useRef<HTMLDivElement>(null);

  // Add click handler to select component
  useEffect(() => {
    if (dom) {
      const handleClick = (e: MouseEvent) => {
        e.stopPropagation();
        actions.selectNode(id);
      };

      dom.addEventListener('click', handleClick);
      return () => {
        dom.removeEventListener('click', handleClick);
      };
    }
  }, [dom, actions, id]);

  // Add visual indicator - only outline on hover (subtle), solid on selected
  useEffect(() => {
    if (dom) {
      if (isActive) {
        dom.style.outline = '2px solid hsl(var(--primary))';
        dom.style.outlineOffset = '-2px';
      } else if (isHover) {
        dom.style.outline = '1px dashed hsl(var(--primary) / 0.4)';
        dom.style.outlineOffset = '-1px';
      } else {
        dom.style.outline = 'none';
        dom.style.outlineOffset = '0';
      }
    }
  }, [dom, isActive, isHover]);

  const getPos = useCallback((dom: HTMLElement | null) => {
    const { top, left } = dom
      ? dom.getBoundingClientRect()
      : { top: 0, left: 0 };

    return {
      top: `${top + 8}px`,
      left: `${left + 8}px`,
    };
  }, []);

  const scroll = useCallback(() => {
    const currentDOM = currentRef.current;
    if (!currentDOM) return;
    const { top, left } = getPos(dom);
    currentDOM.style.top = top;
    currentDOM.style.left = left;
  }, [dom, getPos]);

  useEffect(() => {
    const renderer = document.querySelector('.craftjs-renderer');
    if (renderer) {
      renderer.addEventListener('scroll', scroll);
      return () => {
        renderer.removeEventListener('scroll', scroll);
      };
    }
  }, [scroll]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    actions.delete(id);
  }, [actions, id]);

  const handleSelectParent = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (parent) {
      actions.selectNode(parent);
    }
  }, [actions, parent]);

  // Only show toolbar for selected component (not on hover)
  return (
    <>
      {isActive && dom
        ? ReactDOM.createPortal(
            <div
              ref={currentRef}
              className="fixed flex items-center gap-1 px-2 py-1 text-white bg-primary rounded-md text-xs z-[9999] shadow-lg"
              style={{
                left: getPos(dom).left,
                top: getPos(dom).top,
                pointerEvents: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="mr-1 font-medium">{name}</span>
              {moveable && (
                <button
                  ref={(ref) => {
                    if (ref) {
                      drag(ref);
                    }
                  }}
                  className="p-1 cursor-move hover:bg-white/20 rounded"
                  title="Drag"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Move className="w-3.5 h-3.5" />
                </button>
              )}
              {parent && (
                <button
                  onClick={handleSelectParent}
                  className="p-1 cursor-pointer hover:bg-white/20 rounded"
                  title="Select Parent"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              )}
              {deletable && (
                <button
                  onClick={handleDelete}
                  className="p-1 cursor-pointer hover:bg-red-500 rounded"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>,
            document.body
          )
        : null}
      {render}
    </>
  );
};
