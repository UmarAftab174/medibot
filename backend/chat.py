# backend/chat.py
import time
from itertools import zip_longest
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

SUGGESTED_QUERIES = [
    "Explain my disease in simple words",
    "Is this curable? If yes, how long?",
    "Write prescription & health tips",
    "When should I see a doctor?",
]

_QUERY_MAP = {
    SUGGESTED_QUERIES[0]: (None, "Explain my {disease} in simple words."),
    SUGGESTED_QUERIES[1]: (None, "Is {disease} curable? If yes, how long?"),
    SUGGESTED_QUERIES[2]: (None, "Write prescription & health tips for me to recover from {disease}."),
    SUGGESTED_QUERIES[3]: (None, "When should I see a doctor for my {disease}?"),
}

def _invoke_and_record(prompt_template, model, conversation, human_message_text, parser=None):
    """
    Helper: append the human message to conversation, build the chain, invoke model,
    append AI message and return the AI content (string) and raw result.
    """
    # Don't add human message twice - it's already added in get_query
    # This was causing duplicated messages in the conversation
    # conversation.append(HumanMessage(content=human_message_text))

    if parser:
        prompt = prompt_template.partial(format_instructions=parser.get_format_instructions())
        chain = prompt | model | parser
    else:
        prompt = prompt_template
        chain = prompt | model

    try:
        # Properly pass the messages variable into the chain
        result = chain.invoke({"messages": conversation})
    except Exception as e:
        err_text = f"Error invoking model: {e}"
        conversation.append(AIMessage(content=err_text))
        raise

    ai_content = result.content if hasattr(result, 'content') else str(result)
    conversation.append(AIMessage(content=ai_content))
    print(ai_content)
    return ai_content

def get_query(model, query, system_msg, conversation, disease):
    """
    model: your langchain model object (synchronous)
    conversation: list of Message objects (SystemMessage/HumanMessage/AIMessage)
    """
    if not isinstance(conversation, list):
        raise ValueError("conversation must be a list of messages")

    pydantic_cls, template_str = _QUERY_MAP.get(query, (None, "Disease: {disease}\n{query_text}"))

    # Add the human message to the conversation
    human_message_text = template_str.format(disease=disease, query_text=query)
    conversation.append(HumanMessage(content=human_message_text))

    # Create prompt template with system message and placeholder for conversation
    prompt_template = ChatPromptTemplate.from_messages([
        ('system', system_msg),
        MessagesPlaceholder(variable_name='messages')
    ])

    # No parser for now to avoid JSON parsing issues
    parser = None

    # Invoke the model and record the response
    ai_content = _invoke_and_record(prompt_template, model, conversation, human_message_text, parser)

    timestamp = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())
    return ai_content, timestamp

def chat_history(queries, responses):
    """
    Return a dict of messages where each entry contains query and response.
    Uses zip_longest so mismatched lengths are handled gracefully.
    """
    messages = {}
    for i, (q, r) in enumerate(zip_longest(queries, responses, fillvalue=None)):
        messages[f'message{i+1}'] = {'query': q, 'response': r}
    return messages