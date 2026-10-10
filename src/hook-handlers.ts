// The command handlers of a `hooks` object. The same object is in
// `hooks/hooks.json` and in settings. A handler runs a command, in one of two
// forms. With `args`, Claude Code runs `command` as a program and passes each
// `args` element as one argument. Without `args`, it passes `command` to a
// shell (https://code.claude.com/docs/en/hooks#exec-form-and-shell-form).
import { type DocumentNode, lastMember, type ValueNode } from './marketplace-json.ts'
import { type Word, wordsOf } from './script-refs.ts'

export type StringNode = Extract<ValueNode, { type: 'String' }>

/** A handler with `type` `command`. `args` is undefined for the shell form,
 *  and for an `args` value that is not an array. An `args` element that is
 *  not a string is undefined. */
export interface Handler {
  command: StringNode
  args: (StringNode | undefined)[] | undefined
}

/** The command handler in `value`, as a list of one. The list is empty when
 *  `value` is not a command handler. */
function handlerOf(value: ValueNode): Handler[] {
  const type = lastMember(value, 'type')?.value
  const command = lastMember(value, 'command')?.value
  if (type?.type !== 'String' || type.value !== 'command' || command?.type !== 'String') {
    return []
  }
  const args = lastMember(value, 'args')?.value
  return [
    {
      command,
      args:
        args?.type === 'Array'
          ? args.elements.map(({ value: element }) =>
              element.type === 'String' ? element : undefined,
            )
          : undefined,
    },
  ]
}

/** The command handlers of the last `hooks` key of `document`, in file order.
 *  A value of another shape holds no handler. */
export function commandHandlers(document: DocumentNode): Handler[] {
  const events = lastMember(document.body, 'hooks')?.value
  if (events?.type !== 'Object') {
    return []
  }
  return events.members.flatMap(({ value: groups }) =>
    groups.type === 'Array'
      ? groups.elements.flatMap(({ value: group }) => {
          const handlers = lastMember(group, 'hooks')?.value
          return handlers?.type === 'Array'
            ? handlers.elements.flatMap(({ value }) => handlerOf(value))
            : []
        })
      : [],
  )
}

/** The words that a handler runs: the program first, then its arguments. The
 *  exec form has no shell, so `command` is one word and each `args` element is
 *  one word. The shell form splits `command` the way a shell does. Each word
 *  holds the node that a report points at. */
export function handlerWords({ command, args }: Handler): Word<StringNode>[] {
  if (args === undefined) {
    return wordsOf(command.value).map((text) => ({ text, node: command }))
  }
  return [
    { text: command.value, node: command },
    ...args.flatMap((arg) => (arg === undefined ? [] : [{ text: arg.value, node: arg }])),
  ]
}
