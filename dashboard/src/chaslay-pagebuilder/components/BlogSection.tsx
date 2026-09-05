// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { BlogSectionProps, BlogPost } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { TranslatableInput, TranslatableArrayInput } from './TranslatableInput';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';

const defaultPosts: BlogPost[] = [
  { title: 'The Art of Italian Cooking', excerpt: 'Discover the secrets behind authentic Italian cuisine and the traditions that make it special.', image: '', date: '2024-12-15', author: 'Chef Marco', link: '#' },
  { title: 'Farm to Table: Our Story', excerpt: 'How we source the freshest ingredients from local farms to create unforgettable dishes.', image: '', date: '2024-12-10', author: 'Sarah M.', link: '#' },
  { title: 'Wine Pairing Guide', excerpt: 'Expert tips on choosing the perfect wine to complement your meal at our restaurant.', image: '', date: '2024-12-05', author: 'James W.', link: '#' },
];

const defaultProps: BlogSectionProps = {
  sectionId: SECTION_ANCHORS.blog,
  title: 'From Our Blog',
  subtitle: 'Stories, tips, and culinary inspiration',
  posts: defaultPosts,
  backgroundColor: '#f8f9fa',
  textColor: '#1a1a2e',
  accentColor: '#e94560',
};

export const BlogSection: React.FC<BlogSectionProps> & {
  craft: {
    props: BlogSectionProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      id={sectionAnchorId(mergedProps.sectionId, 'blog')}
      className="hb-section hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        width: '100%',
        boxSizing: 'border-box',
        padding: '64px 20px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        {mergedProps.title && (
          <h3 style={{ color: mergedProps.textColor, fontSize: '28px', fontWeight: 600, marginBottom: '12px' }}>
            {mergedProps.title}
          </h3>
        )}
        {mergedProps.subtitle && (
          <p style={{ color: mergedProps.textColor, opacity: 0.6, fontSize: '16px' }}>
            {mergedProps.subtitle}
          </p>
        )}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min((mergedProps.posts || []).length, 3)}, 1fr)`,
        gap: '24px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}>
        {(mergedProps.posts || []).map((post, i) => (
          <div key={i} style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}>
            {post.image ? (
              <img src={post.image} alt={post.title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '100%',
                height: '200px',
                background: `linear-gradient(135deg, ${mergedProps.accentColor}18, ${mergedProps.accentColor}05)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
              }}>
                📝
              </div>
            )}
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                {post.date && (
                  <span style={{ color: mergedProps.accentColor, fontSize: '12px', fontWeight: 500 }}>
                    {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
                {post.author && (
                  <span style={{ color: mergedProps.textColor, opacity: 0.5, fontSize: '12px' }}>
                    by {post.author}
                  </span>
                )}
              </div>
              <h4 style={{ color: mergedProps.textColor, fontSize: '18px', fontWeight: 600, marginBottom: '8px', lineHeight: 1.3 }}>
                {post.title}
              </h4>
              <p style={{ color: mergedProps.textColor, opacity: 0.7, fontSize: '14px', lineHeight: 1.6 }}>
                {post.excerpt}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BlogSectionSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    subtitle: node.data.props.subtitle ?? defaultProps.subtitle,
    posts: node.data.props.posts ?? defaultProps.posts,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    accentColor: node.data.props.accentColor ?? defaultProps.accentColor,
  }));

  const addPost = () => setProp((props: BlogSectionProps) => {
    props.posts = [...(props.posts || []), { title: 'New Post', excerpt: 'Post excerpt...', image: '', date: new Date().toISOString().split('T')[0], author: '', link: '#' }];
  });
  const removePost = (i: number) => setProp((props: BlogSectionProps) => {
    props.posts = (props.posts || []).filter((_, idx) => idx !== i);
  });

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={p.title} onChange={(v) => setProp((props: BlogSectionProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <TranslatableInput label="Subtitle" propKey="subtitle" value={p.subtitle} onChange={(v) => setProp((props: BlogSectionProps) => (props.subtitle = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: BlogSectionProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={p.textColor} onChange={(e) => setProp((props: BlogSectionProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Accent</Label>
          <Input type="color" value={p.accentColor} onChange={(e) => setProp((props: BlogSectionProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label>Blog Posts</Label>
          <Button variant="outline" size="sm" onClick={addPost}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {(p.posts || []).map((post: BlogPost, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removePost(i)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="w-3 h-3" /></Button>
              </div>
              <TranslatableArrayInput propKey="title" arrayPropKey="posts" index={i} nodeProps={p.nodeProps} setProp={setProp} value={post.title} onChange={(v) => setProp((props: BlogSectionProps) => { if (props.posts) props.posts[i].title = v; })} placeholder="Title" className="h-8 text-xs" />
              <TranslatableArrayInput propKey="excerpt" arrayPropKey="posts" index={i} nodeProps={p.nodeProps} setProp={setProp} value={post.excerpt} onChange={(v) => setProp((props: BlogSectionProps) => { if (props.posts) props.posts[i].excerpt = v; })} placeholder="Excerpt" className="text-xs" multiline rows={2} />
              <Input value={post.image || ''} onChange={(e) => setProp((props: BlogSectionProps) => { if (props.posts) props.posts[i].image = e.target.value; })} placeholder="Image URL" className="h-8 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={post.date || ''} onChange={(e) => setProp((props: BlogSectionProps) => { if (props.posts) props.posts[i].date = e.target.value; })} className="h-8 text-xs" />
                <Input value={post.author || ''} onChange={(e) => setProp((props: BlogSectionProps) => { if (props.posts) props.posts[i].author = e.target.value; })} placeholder="Author" className="h-8 text-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

BlogSection.craft = {
  props: defaultProps,
  related: { settings: BlogSectionSettings },
  displayName: 'Blog Section',
};
