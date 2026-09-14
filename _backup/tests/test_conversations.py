from p2.conversation import ConversationTurn
from p2.conversations import ConversationStore


def test_the_chunks_behind_an_answer_survive_a_reload(tmp_path):
    store = ConversationStore(str(tmp_path))
    conversation = store.create()
    source = {"rank": 1, "id": "f.py::best", "file": "f.py", "startLine": 1,
              "endLine": 2, "kind": "function", "qualifiedName": "best",
              "distance": 0.1, "content": "def best(): pass"}

    store.append(conversation.id, [
        ConversationTurn(role="user", content="what is best?"),
        ConversationTurn(role="assistant", content="It passes.", sources=[source]),
    ])

    turns = store.get(conversation.id).turns
    assert turns[0].sources is None
    assert turns[1].sources == [source]
