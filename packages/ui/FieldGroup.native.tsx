// Native fork: the NYC-MON night panels render in the kit on native too. The
// @expo/ui platform FieldGroup could only hold @expo/ui rows (a native list
// cannot lay out a React Native subtree), and the kit's Switch, Checkbox and
// fields are kit components now, so the platform list had nothing to group.
export { FieldGroup } from './FieldGroup.web';
