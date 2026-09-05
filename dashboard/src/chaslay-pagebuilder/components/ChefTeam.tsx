// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { ChefTeamProps, TeamMember } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { TranslatableInput, TranslatableArrayInput } from './TranslatableInput';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';

const defaultMembers: TeamMember[] = [
  { name: 'Marco Rossi', role: 'Head Chef', photo: '', bio: '15 years of culinary excellence' },
  { name: 'Sophie Laurent', role: 'Pastry Chef', photo: '', bio: 'Award-winning dessert creations' },
  { name: 'James Chen', role: 'Sous Chef', photo: '', bio: 'Master of Asian fusion cuisine' },
];

const defaultProps: ChefTeamProps = {
  sectionId: SECTION_ANCHORS.team,
  title: 'Meet Our Team',
  subtitle: 'Passionate culinary artists behind every dish',
  members: defaultMembers,
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
  accentColor: '#e94560',
  columns: 3,
};

export const ChefTeam: React.FC<ChefTeamProps> & {
  craft: {
    props: ChefTeamProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      id={sectionAnchorId(mergedProps.sectionId, 'team')}
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
        gridTemplateColumns: `repeat(${mergedProps.columns || 3}, 1fr)`,
        gap: '32px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}>
        {(mergedProps.members || []).map((member, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            {member.photo ? (
              <img
                src={member.photo}
                alt={member.name}
                style={{ width: '160px', height: '160px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 16px' }}
              />
            ) : (
              <div style={{
                width: '160px',
                height: '160px',
                borderRadius: '50%',
                backgroundColor: `${mergedProps.accentColor}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '48px',
                color: mergedProps.accentColor,
                fontWeight: 700,
              }}>
                {member.name.charAt(0)}
              </div>
            )}
            <h4 style={{ color: mergedProps.textColor, fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
              {member.name}
            </h4>
            <p style={{ color: mergedProps.accentColor, fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
              {member.role}
            </p>
            {member.bio && (
              <p style={{ color: mergedProps.textColor, opacity: 0.6, fontSize: '14px', lineHeight: 1.5 }}>
                {member.bio}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ChefTeamSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    subtitle: node.data.props.subtitle ?? defaultProps.subtitle,
    members: node.data.props.members ?? defaultProps.members,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    accentColor: node.data.props.accentColor ?? defaultProps.accentColor,
    columns: node.data.props.columns ?? defaultProps.columns,
  }));

  const addMember = () => setProp((props: ChefTeamProps) => {
    props.members = [...(props.members || []), { name: 'New Member', role: 'Chef', photo: '', bio: '' }];
  });
  const removeMember = (i: number) => setProp((props: ChefTeamProps) => {
    props.members = (props.members || []).filter((_, idx) => idx !== i);
  });

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={p.title} onChange={(v) => setProp((props: ChefTeamProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <TranslatableInput label="Subtitle" propKey="subtitle" value={p.subtitle} onChange={(v) => setProp((props: ChefTeamProps) => (props.subtitle = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <div className="space-y-2">
        <Label>Columns</Label>
        <Input type="number" min={1} max={4} value={p.columns} onChange={(e) => setProp((props: ChefTeamProps) => (props.columns = parseInt(e.target.value) || 3))} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: ChefTeamProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={p.textColor} onChange={(e) => setProp((props: ChefTeamProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Accent</Label>
          <Input type="color" value={p.accentColor} onChange={(e) => setProp((props: ChefTeamProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label>Team Members</Label>
          <Button variant="outline" size="sm" onClick={addMember}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {(p.members || []).map((member: TeamMember, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeMember(i)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="w-3 h-3" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TranslatableArrayInput propKey="name" arrayPropKey="members" index={i} nodeProps={p.nodeProps} setProp={setProp} value={member.name} onChange={(v) => setProp((props: ChefTeamProps) => { if (props.members) props.members[i].name = v; })} placeholder="Name" className="h-8 text-xs" />
                <TranslatableArrayInput propKey="role" arrayPropKey="members" index={i} nodeProps={p.nodeProps} setProp={setProp} value={member.role} onChange={(v) => setProp((props: ChefTeamProps) => { if (props.members) props.members[i].role = v; })} placeholder="Role" className="h-8 text-xs" />
              </div>
              <Input value={member.photo || ''} onChange={(e) => setProp((props: ChefTeamProps) => { if (props.members) props.members[i].photo = e.target.value; })} placeholder="Photo URL" className="h-8 text-xs" />
              <TranslatableArrayInput propKey="bio" arrayPropKey="members" index={i} nodeProps={p.nodeProps} setProp={setProp} value={member.bio || ''} onChange={(v) => setProp((props: ChefTeamProps) => { if (props.members) props.members[i].bio = v; })} placeholder="Bio" className="text-xs" multiline rows={2} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

ChefTeam.craft = {
  props: defaultProps,
  related: { settings: ChefTeamSettings },
  displayName: 'Chef Team',
};
