import React from "react";
import type { RadioChangeEvent } from "antd";
import { Radio } from "antd";
import { LOCALSTORAGE_AUTH } from "../../constants";
import { OPENAI_MODEL, GPT_35_TURBO, GPT_35_TURBO_16K, GPT_4, GPT_4_32K } from "../../constants";

interface OpenaiModelRadioProps {
    disabled: boolean;
    openaiModel: string;
    setOpenaiModel: (model: string) => void;
}

export const OpenaiModelRadio: React.FC<OpenaiModelRadioProps> = ({ disabled, openaiModel, setOpenaiModel }) => {
    const user_auth = localStorage.getItem(LOCALSTORAGE_AUTH);
    const model_list: string[] = user_auth ? JSON.parse(user_auth)["openai_model"] : [];
    if (openaiModel && model_list.indexOf(openaiModel) === -1) {
        model_list.push(openaiModel);
    }
    return (
        <Radio.Group
            disabled={disabled}
            onChange={(e: RadioChangeEvent) => {
                setOpenaiModel(e.target.value);
            }}
            value={openaiModel}
            defaultValue={GPT_35_TURBO}
            buttonStyle="solid"
            style={{ marginBottom: 16 }}
        >
            {model_list.map((model: string) => {
                switch (model) {
                    case GPT_35_TURBO:
                        return <Radio.Button key={GPT_35_TURBO} value={GPT_35_TURBO}>{OPENAI_MODEL[GPT_35_TURBO]}</Radio.Button>;
                    case GPT_35_TURBO_16K:
                        return <Radio.Button key={GPT_35_TURBO_16K} value={GPT_35_TURBO_16K}>{OPENAI_MODEL[GPT_35_TURBO_16K]}</Radio.Button>;
                    case GPT_4:
                        return <Radio.Button key={GPT_4} value={GPT_4}>{OPENAI_MODEL[GPT_4]}</Radio.Button>;
                    case GPT_4_32K:
                        return <Radio.Button key={GPT_4_32K} value={GPT_4_32K}>{OPENAI_MODEL[GPT_4_32K]}</Radio.Button>;
                }
            })}
        </Radio.Group>
    );
};
