# ADR-0038: Making a group is a screen, and people are added by a search

- Status: Accepted
- Date: 2026-11-17

## Context

On the Groups screen, New group was a `block` button that unfolded the whole form of a new group under it, and Invite a friend a primary `block` button. A `Button` at rest is its bottom edge alone ([ADR-0023](0023-buttons-and-fields-draw-their-notch-as-used.md)), and so is every `Card` ([ADR-0033](0033-a-card-is-its-bottom-edge.md)): the controls looked like one more row of the lists they sat on. Moving them under the lists would have made that worse.

Adding people was split in two in both places that do it, the form of a new group and the People of a group: a field to add somebody by name (a dummy) and, apart, a `Select` of the person's friends with its own button. The person had to know first which of the two the somebody was.

## Decision

Confirmed by the owner:

- **The action of a section of Groups is in the row of its heading**, at its end: a small ghost `Button` with the `add` icon, "New" for Groups and "Invite" for Friends. It is not a row of the list, so it can't be read as one. Invite still makes a link at once ([ADR-0014](0014-people-in-groups.md)), and the open links stay listed under the heading with the hint.
- **Making a group is a screen of its own, `/groups/new`**, deeper than Groups: the header's way back leads to Groups, and no swipe starts there ([ADR-0035](0035-a-swipe-moves-between-screens.md)). It holds the name, Add people, the people added (each with Remove) and Make the group, which opens the group made. It is not a sheet: [ADR-0016](0016-forms-for-a-task-open-in-a-sheet.md) keeps a sheet for the short task done from any screen and left to go back where the person was, while making a group makes a place the person goes on to; a screen also leaves room for the search to open over it without a dialog over a dialog.
- **People are added by one search, the same in both places.** Add people (on the new group) and Add a person (in the People of a group) open a sheet (`Dialog` variant `page` below 40 rem, the floating dialog from 40 rem) with a search field first and, under it, rows to press: the person's open friends whose name holds what is typed, ignoring case and accents (all of them while the field is empty), and last, once what is typed is a name a group takes, "Add “<name>” by name", a dummy. Friends come first, so the real person is found before a dummy is made that would have to be merged later. A row is a button; there is no combobox and Enter presses nothing. The sheet stays open after each one, with the field emptied and the focus back in it, and says who was added; a tap outside closes it, as nothing is lost.
- On the new group, a row only lists the person (a friend once); nothing is sent until the group is made, as before. In the People of a group, a row adds them at once, and a refusal is said in the sheet. **In place of a dummy** stays a step of adding a friend: for the owner of a group with dummies, pressing a friend asks in the sheet whether they come in as a new member or in place of one of the dummies. A member carries no user, so the device can't leave out a friend who is in the group already: the server says so, as it did.

## Consequences

- The form of a new group leaves the Groups screen; `NewGroup` becomes the screen of `/groups/new`, with the `Select` of friends and the field by name gone.
- The People of a group lose their two forms for one button; the step of In place of moves from under the `Select` into the sheet.
- One component draws the search for both, told by whoever opens it what a press does.

## Alternatives considered

- **A dialog for New group**: on a phone the `page` variant looks like a screen anyway, but the search would have opened a second dialog over it.
- **The friends as checkboxes with a field by name under them**: no search to build, but a long list of friends to scroll on every group, and still two ways in.
- **One field that suggests friends as it is typed into (a combobox)**: a list of options built by hand, and a name that is also a friend's would have left unclear which of the two was added.
- **"Add by name" first**, before the friends: a dummy would be one press away when the person was a friend all along.
