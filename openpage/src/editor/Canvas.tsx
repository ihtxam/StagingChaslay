import { useMemo } from 'react'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { CanvasEmpty } from './CanvasEmpty'
import { BlockWrapper } from '@/blocks/BlockWrapper'
import { RenderBlock } from '@/blocks/registry'
import { resolveTheme, themeToCSS } from '@/lib/theme-presets'
import { useGoogleFonts } from '@/lib/useGoogleFonts'
import { isEmbedMode } from '@/lib/embed-bridge'

export function Canvas() {
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const theme = useConfigStore((s) => s.config.theme)
  const { selectedBlockId, selectBlock, viewport } = useEditorStore()
  const embed = isEmbedMode()

  const resolved = useMemo(() => resolveTheme(theme), [theme])
  const cssVars = useMemo(() => themeToCSS(resolved), [resolved])
  useGoogleFonts([resolved.fontSans, resolved.fontDisplay, resolved.fontMono])

  const maxWidth = embed
    ? '100%'
    : viewport === 'desktop'
      ? '880px'
      : viewport === 'tablet'
        ? '768px'
        : '375px'

  const pageSurfaceStyle = {
    width: '100%',
    maxWidth,
    ...cssVars,
    color: 'var(--color-text-0)',
    backgroundColor: 'var(--color-bg-0)',
    fontFamily: 'var(--font-sans)',
    borderColor: embed ? 'transparent' : 'var(--color-border-default)',
  } as React.CSSProperties

  if (blocks.length === 0) {
    return <CanvasEmpty />
  }

  const canvasContent = (
    <div
      className={`@container relative z-[1] overflow-hidden transition-all duration-300 ${
        embed ? 'min-h-full rounded-none border-0' : 'min-h-[400px] border rounded-xl'
      }`}
      style={pageSurfaceStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) selectBlock(null)
      }}
      role="region"
      aria-label={`Site preview, ${blocks.length} blocks, ${viewport} viewport`}
    >
      {blocks.map((block, index) => (
        <BlockWrapper
          key={block.id}
          block={block}
          blockIndex={index}
          isSelected={selectedBlockId === block.id}
          onSelect={() => selectBlock(block.id)}
        >
          <RenderBlock block={block} />
        </BlockWrapper>
      ))}
    </div>
  )

  return (
    <div
      className={`flex-1 flex items-start justify-center overflow-auto relative ${
        embed ? 'p-0' : 'p-6'
      }`}
      style={embed ? pageSurfaceStyle : undefined}
    >
      {!embed ? (
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--color-bg-3) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
      ) : null}

      {embed || viewport === 'desktop' ? (
        <div className="relative z-[1] w-full">{canvasContent}</div>
      ) : viewport === 'tablet' ? (
        <div className="relative z-[1]">
          <div className="border-[12px] border-bg-4 rounded-2xl bg-bg-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="rounded-lg overflow-hidden">{canvasContent}</div>
          </div>
        </div>
      ) : (
        <div className="relative z-[1]">
          <div className="border-[10px] border-bg-4 rounded-[2rem] bg-bg-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex justify-center -mt-[4px] mb-1">
              <div className="w-24 h-5 bg-bg-4 rounded-b-xl" />
            </div>
            <div className="rounded-xl overflow-hidden">{canvasContent}</div>
            <div className="flex justify-center mt-2 pb-1">
              <div className="w-28 h-1 bg-bg-5 rounded-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
