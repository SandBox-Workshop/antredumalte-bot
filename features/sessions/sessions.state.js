const sessions = new Map();

export function createSession(messageId, session) {
  const state = {
    ...session,
    participants: new Set([session.creatorId]),
    maybes: new Set(),
  };

  sessions.set(messageId, state);

  return state;
}

export function getSession(messageId) {
  return sessions.get(messageId) ?? null;
}

export function joinSession(messageId, userId) {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  session.maybes.delete(userId);
  session.participants.add(userId);

  return session;
}

export function maybeSession(messageId, userId) {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  session.participants.delete(userId);
  session.maybes.add(userId);

  return session;
}

export function leaveSession(messageId, userId) {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  session.participants.delete(userId);
  session.maybes.delete(userId);

  return session;
}

export function transferSessionHost(messageId, newHostId) {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  session.maybes.delete(newHostId);
  session.participants.add(newHostId);

  session.creatorId = newHostId;

  return session;
}

export function cancelSession(messageId) {
  const session = getSession(messageId);

  if (!session) {
    return null;
  }

  sessions.delete(messageId);

  return session;
}
