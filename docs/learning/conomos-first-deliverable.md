# Encore's door workflow

This note describes the planned MVP behavior, not a working door ledger. The current application provides a setup landing page and local database fixtures; it cannot record admissions yet.

## Why entry counts matter

bar owners want to know how many people enter their bar, its good data

Encore records entries, not unique people: someone who leaves and returns can count as another entry. Recorded occupancy describes how many people are still inside according to the ledger.

## Paid entry, free entry, and exit

- A paid entry admits one person, increases recorded occupancy by one, and adds the charged admission amount to expected cover.
- A free entry admits one person and increases recorded occupancy by one, but adds $0 to expected cover.
- An exit reduces recorded occupancy by one without refunding cover. Expected cover stays the same.

## A small example

Start with zero people inside and $0 expected cover. Four people enter and each pays $10. Recorded occupancy is now 4 and expected cover is $40. One person exits: recorded occupancy becomes **3**, while expected cover remains **$40**.

Expected cover comes from recorded admission charges, not the number of people still inside. It is not proof of how much cash is actually in the drawer.

## Scope and an operator question

The MVP does not send SMS marketing messages.

One question for a door operator: when the screen does not confirm that an entry saved, how would you keep track of that guest while checking whether the entry was recorded?

See the [MVP specification](../MVP.md) for the planned behavior and [current project context](../CONTEXT.md) for what is implemented.
