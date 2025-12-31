import traceback

import google.generativeai as genai
from google.api_core.exceptions import DeadlineExceeded, GoogleAPICallError, ResourceExhausted

import settings


genai.configure(api_key=settings.GEMINI_API_KEY)


class AIAgent:
    def __init__(self, model_name=None):
        self.model_name = model_name or settings.GEMINI_MODEL_NAME
        self.model = genai.GenerativeModel(self.model_name)
        self.system_prompt = (
            """
        あなたは親しみやすく知識豊富なAIチャットボットです。

        【基本方針】
        1. 提供された資料に基づいて正確に回答する
        2. 自然で親しみやすい対話を心がける
        3. 質問の意図を理解し、適切な情報を選択して回答する

        【回答の作り方】
        1. 質問に直接関連する最も重要な情報を優先する
        2. 具体的な情報や特徴を含める
        3. 結論や要点を明確に示す
        4. 専門用語には簡潔な説明を添える

        【文章の構成】
        1. 簡潔で分かりやすい文章構成
        2. 重要なポイントは**太字**で強調
        3. 情報を整理して箇条書きやリストを活用
        4. 適度な改行で読みやすさを重視
        """
        )

    def _build_contextual_fallback(self, context, base_message):
        if not context or not context.strip():
            return base_message

        sections = [segment.strip() for segment in context.split("\n---\n") if segment.strip()]
        if not sections:
            return base_message

        snippet = "\n---\n".join(sections[:2])
        if len(snippet) > 1200:
            snippet = snippet[:1200].rstrip() + "..."

        return f"{base_message}\n\n【参考情報（ナレッジからの抜粋）】\n{snippet}"

    def think_and_respond(self, query, context="", system_prompt=None, only_page_context=False):
        if not context.strip():
            if only_page_context:
                return "現在のページに関する情報が見つかりませんでした。ページの内容を確認して再度お試しください。"
            return "申し訳ありませんが、お尋ねの件について保存されている情報が見つかりませんでした。もう少し詳しく教えていただけますでしょうか？"

        prompt_header = system_prompt if system_prompt else self.system_prompt

        # ページのみモードの場合、プロンプトを変更
        if only_page_context:
            prompt = f"""
        {prompt_header}

        【重要な指示】
        - 以下に提供された「ページの情報」のみを使って回答してください
        - ページに記載されていない情報については「このページには記載されていません」と回答してください
        - ページの内容を正確に要約・説明してください

        【ページの情報】
        {context}

        【ユーザーの質問】
        {query}

        上記のページ情報のみに基づいて、簡潔で分かりやすく回答してください。
        """
        else:
            prompt = f"""
        {prompt_header}

        【利用可能な情報】
        {context}

        【ユーザーの質問】
        {query}

        上記の情報の中から、質問に最も適した内容を選択し、以下の点に注意してチャットボットとして回答してください：

        1. **構造化された回答**: 複数のポイントがある場合は、適切に整理して提示する
        2. **読みやすさ**: 長い文章は段落分けし、重要な箇所は強調する
        3. **簡潔性**: 冗長な表現を避け、要点を明確に伝える
        4. **親しみやすさ**: 自然で人間らしい対話スタイルを維持する
        5. **情報の関連性**: 質問の意図に最も合う情報を中心に、分かりやすく説明する

        情報が複数ある場合は、質問の意図に最も合うものを中心に、整理された形で回答してください。
        """

        try:
            response = self.model.generate_content(prompt)
            return response.text
        except DeadlineExceeded as e:
            print("Gemini DeadlineExceeded:", e)
            traceback.print_exc()
            return "現在AIの応答生成に時間がかかっています。少し待ってからもう一度お試しください。"
        except ResourceExhausted as e:
            print("Gemini quota exhausted:", e)
            traceback.print_exc()
            message = "Gemini APIの利用上限に達しました"
            return self._build_contextual_fallback(context, message)
        except GoogleAPICallError as e:
            print("Gemini API error:", e)
            traceback.print_exc()
            message = "AIサービスの呼び出しに失敗しました。時間をおいて再度お試しください。"
            return self._build_contextual_fallback(context, message)
        except Exception as e:
            print("Unexpected Gemini error:", e)
            traceback.print_exc()
            return "回答の生成中にエラーが発生しました。別の質問でお試しいただけますか？"
