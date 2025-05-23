import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/bs-ui/select";
import { forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import InputComponent from "../../../components/inputComponent";
import InputFileComponent from "../../../components/inputFileComponent";
import { Button } from "../../../components/bs-ui/button";
import { alertContext } from "../../../contexts/alertContext";
import { Variable, VariableType, getVariablesApi } from "../../../controllers/API/flow";

/**
 * @component 会话报告生成专用表单
 * @description
 * 表单项数据由组件的参数信息和单独接口获取的必填信息及排序信息而来。
 */
const ChatReportForm = forwardRef(({ type = 'chat', vid = 0, flow, onStart }, ref) => {
    const { setErrorData } = useContext(alertContext);
    const { t } = useTranslation()

    useImperativeHandle(ref, () => ({
        submit: () => {
            handleStart()
        }
    }));

    // 从 api中获取
    const [items, setItems] = useState<Variable[]>([])
    useEffect(() => {
        // chat -》L1； diff -> 对比测试
        type === 'chat' ? getVariablesApi({ flow_id: flow.flow_id || flow.id }).then(
            res => setItems(res)
        ) : getVariablesApi({ version_id: vid, flow_id: flow.flow_id || flow.id }).then(
            res => setItems(res)
        )
    }, [])

    const handleChange = (index, value) => {
        setItems((_items) => _items.map((item, i) =>
            i === index ? { ...item, value } : item))
    }

    // 文件名 kv关系
    const fileKindexVpath = useRef({})
    const handleStart = () => {
        // 校验
        const errors = items.reduce((res, el) => {
            if (el.required && !el.value) {
                res.push(`${el.name} ${t('report.isRequired')}`)
            }
            if (el.type === VariableType.Text && el.value.length > Number(el.maxLength)) {
                res.push(`${el.name} ${t('report.varLength')} ${el.maxLength}`)
            }
            return res
        }, [])
        if (errors.length) {
            return setErrorData({
                title: t('prompt'),
                list: errors,
            });
        }

        // 组装数据，抛出
        const obj = items
        const str = items.map((el, i) => `${el.name ? el.name + '：' : ''}${el.type === VariableType.File
            ? fileKindexVpath.current[i] : el.value}\n`).join('')
        onStart(obj, str)
    }

    return <div className="flex flex-col gap-6 rounded-xl p-4 ">
        <div className="max-h-[520px] overflow-y-auto">
            {items.map((item, i) => <div key={item.id} className="w-full text-sm">
                {item.name}
                <span className="text-status-red">{item.required ? " *" : ""}</span>
                <div className="mt-2">
                    {item.type === VariableType.Text ? <InputComponent
                        type='textarea'
                        password={false}
                        value={item.value}
                        onChange={(val) => handleChange(i, val)}
                    /> :
                        item.type === VariableType.Select ?
                            <Select onValueChange={(val) => handleChange(i, val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {
                                            item.options.map(el => <SelectItem key={el.value} value={el.value}>{el.value}</SelectItem>)
                                        }
                                    </SelectGroup>
                                </SelectContent>
                            </Select> :
                            item.type === VariableType.File ?
                                <InputFileComponent
                                    isSSO
                                    disabled={false}
                                    placeholder={t('report.fileRequired')}
                                    value={''}
                                    onChange={(e) => fileKindexVpath.current[i] = e}
                                    fileTypes={["pdf"]}
                                    suffixes={flow.data.nodes.find(el => el.id === item.nodeId)
                                        ?.data.node.template.file_path.suffixes || ['xxx']}
                                    onFileChange={(val: string) => handleChange(i, val)}
                                ></InputFileComponent> : <></>
                    }
                </div>
            </div>
            )}
        </div>
        {type === 'chat' && <Button size="sm" onClick={handleStart}>{t('report.start')}</Button>}
    </div>
});

export default ChatReportForm