'use strict';

const URI_ORDER_DATA = './orderData.json';

const SELECTOR_LOADING = '[data-loading]'
const SELECTOR_FACTORS = 'select[data-factors]';
const SELECTOR_BTN_INSPECTION = 'button[data-get-inspection]';
const SELECTOR_BTN_CONTRAINDICATIONS = 'button[data-get-contraindications]';
const SELECTOR_BTN_RESET = 'button[type="reset"]';
const SELECTOR_BTN_PRINT = 'button[data-print]';
const SELECTOR_RESULTS = '[data-results]';
const SELECTOR_ALERT = '[data-alert]';
const SELECTOR_ALERT_FACTORS = '[data-alert-factors]';
const SELECTOR_ALERT_BUTTONS = '[data-alert-buttons] button';

const CLASSNAME_DISPLAY_NONE = 'd-none';


document.addEventListener('DOMContentLoaded', init);


async function init() {
    const response = await fetch(URI_ORDER_DATA);
    if (!response.ok) {
        alert('Ошибка при загрузке ресурсов');
        return;
    }
    const orderData = await response.json();

    document.querySelector(SELECTOR_LOADING).remove();

    const select = new FactorsSelect(SELECTOR_FACTORS, orderData);
    select.init();

    const renderResult = new ResultRenderHelper(SELECTOR_RESULTS, SELECTOR_BTN_PRINT, CLASSNAME_DISPLAY_NONE);
    const alert = new FactorsAlert(SELECTOR_ALERT, SELECTOR_ALERT_FACTORS, SELECTOR_ALERT_BUTTONS, CLASSNAME_DISPLAY_NONE, select);
    select.handleChange(selection => alert.check(selection));

    const buttons = {
        getInspections: document.querySelector(SELECTOR_BTN_INSPECTION),
        getContraindications: document.querySelector(SELECTOR_BTN_CONTRAINDICATIONS),
        reset: document.querySelector(SELECTOR_BTN_RESET),
        print: document.querySelector(SELECTOR_BTN_PRINT)
    };

    buttons.getInspections.addEventListener('click', event => {
        event.preventDefault();
        renderResult.clear();
        alert.hide();

        const selection = select.getSelection();
        if (!selection.length) {
            return;
        }

        const keys = getKeysString(selection);
        renderResult.addHeader(`Объем обследований для пунктов: ${keys}`);
        renderResult.renderInspectionValues('Врачи-специалисты', 'doctors', orderData, selection);
        renderResult.renderInspectionValues('Лабораторные и функциональные исследования', 'examinations', orderData, selection);
        const generalInspections = orderData.general.doctors.concat(orderData.general.examinations);
        renderResult.addValues(generalInspections, 'Общие обследования');
        renderResult.showPrintBtn();
    });

    buttons.getContraindications.addEventListener('click', event => {
        event.preventDefault();
        renderResult.clear();
        alert.hide();

        const selection = select.getSelection();
        if (!selection.length) {
            return;
        }

        const keys = getKeysString(selection);
        renderResult.addHeader(`Противопоказания для пунктов: ${keys}`);
        renderResult.renderInspectionValues(null, 'contraindications', orderData, selection);
        renderResult.addValues(orderData.general.contraindications.absolute, 'Общие противопоказания');

        if (selection.some(item => compareFactorKeys(item.key, '23') < 0)) {
            renderResult.addValues(orderData.general.contraindications.from1to22, 'Общие противопоказания для пунктов с 1 по 22');
        }

        renderResult.showPrintBtn();
    });

    buttons.reset.addEventListener('click', event => {
        event.preventDefault();
        select.clear();
        renderResult.clear();
    });

    buttons.print.addEventListener('click', event => {
        event.preventDefault();
        window.print();
    })
}


function FactorsSelect(selector, orderData) {
    const _getOptions = () => {
        const factors = orderData.factors;
        return Object.keys(factors).map(key => {
            return {
                id: key,
                text: `${key}. ${factors[key].name}`,
                factor: factors[key]
            }
        }).sort((x, y) => compareFactorKeys(x.id, y.id));
    };
    const _formatOption = option => {
        const html = `<span style="display: block; overflow: hidden; white-space: nowrap;" title="${option.text}">${option.text}</span>`;
        return $(html);
    };
    const _formatSelection = option => { return option.id };

    // Public

    this.clear = () => $(selector).val(null).trigger('change');
    this.getSelection = () => {
        return $(selector).select2('data')
            .map(data => {
                return {
                    key: data.id,
                    name: data.factor.name,
                    doctors: data.factor.doctors,
                    examinations: data.factor.examinations,
                    contraindications: data.factor.contraindications
                };
            });
    };
    this.init = () => {
        $(selector).select2({
            data: _getOptions(),
            multiple: true,
            placeholder: 'Введите номер или название пункта для поиска...',
            theme: 'bootstrap4',
            width: '100%',
            templateResult: _formatOption,
            templateSelection: _formatSelection,
            language: {
                noResults: () => 'Совпадений не найдено'
            }
        });
    };
    this.handleChange = handler => $(selector).on('change', () => handler(this.getSelection()));
    this.select = (...options) => {
        const newValue = $(selector).val().concat(options);
        $(selector).val(newValue);
        $(selector).trigger('change');
    };
}


function FactorsAlert(targetSelector, alertFactorsSelector, btnsSelector, displayNoneClassname, factorsSelect) {
    const _target = document.querySelector(targetSelector);
    const _factorsList = document.querySelector(alertFactorsSelector);
    const _buttons = document.querySelectorAll(btnsSelector);

    const _getAlertData = selection => {
        let letters = [];
        const factorsWithLetters = [];
        selection.forEach(factor => {
            let nameLetters = factor.name.match(/(?<=\[).+?(?=\])/g)
                ?.map(letter => [...letter]) // "АКР" ---> "А", "К", "Р"
                .flat()
                .filter(letter => /[АКРФ]/.test(letter));
            if (nameLetters && nameLetters.length) {
                letters = letters.concat(nameLetters);
                factorsWithLetters.push(factor);
            }
        });
        letters = distinct(letters);

        return {
            needAlert: letters.length !== 0,
            letters,
            factorsWithLetters
        };
    };

    const _showButtons = letters => {
        _buttons.forEach(btn => {
            if (letters.includes(btn.innerText)) {
                btn.classList.remove(displayNoneClassname);
            }
        });
    };

    const _clear = () => {
        _factorsList.innerHTML = '';
        _buttons.forEach(btn => {
            btn.classList.add(displayNoneClassname);
        });
    };

    _buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            factorsSelect.select(btn.innerText);
        });
    });

    // Public

    this.show = () => {
        _target.classList.remove(displayNoneClassname);
    };
    this.hide = () => {
        _target.classList.add(displayNoneClassname);
        _clear();
    };
    this.check = selection => {
        _clear();
        const alertData = _getAlertData(selection);
        if (!alertData.needAlert) {
            this.hide();
            return;
        }
        alertData.factorsWithLetters.forEach(factor => {
            const li = document.createElement('li');
            li.innerText = `${factor.key}. ${factor.name}`;
            _factorsList.appendChild(li);
        });
        _showButtons(alertData.letters);
        this.show();
    };
}


function ResultRenderHelper(targetSelector, printBtnSelector, displayNoneClassname) {
    const _target = document.querySelector(targetSelector);
    const _printBtn = document.querySelector(printBtnSelector);
    const _appendTextElement = (tag, text) => {
        const element = document.createElement(tag);
        element.innerText = text;
        _target.appendChild(element);
    };

    // Public

    this.addHeader = text => _appendTextElement('h4', text);
    this.showPrintBtn = () => {
        if (!isMobile()) {
            _printBtn.classList.remove(displayNoneClassname);
        }
    };
    this.addValues = (items, subheader = null) => {
        if (subheader) {
            _appendTextElement('h5', subheader);
        }
        const list = document.createElement('ul');
        items.forEach(item => {
            const li = document.createElement('li');
            li.innerText = item;
            list.appendChild(li);
        })
        _target.appendChild(list);
    };
    this.clear = () => {
        _target.innerHTML = '';
        _printBtn.classList.add(displayNoneClassname);
    };

    this.renderInspectionValues = (subheder, path, orderData, selection) => {
        const identifiers = selection
            .map(item => item[path])
            .flat();
        if (identifiers.length) {
            let values = distinct(identifiers)
                .map(id => orderData[path][id]);
            this.addValues(values, subheder);
        }
    }
}


// Util

function compareFactorKeys(x, y) {
    const xParts = x.split('.');
    const yParts = y.split('.');
    const partsLength = Math.max(xParts.length, yParts.length);
    if (partsLength > 0) {
        for (let i = 0; i < partsLength; i++) {
            if (xParts.length <= i) return -1;
            if (yParts.length <= i) return 1;

            const xPart = xParts[i];
            const yPart = yParts[i];

            const xNum = +xPart;
            const yNum = +yPart;

            if (!Number.isInteger(xNum) || !Number.isInteger(yNum)) {
                if (xPart !== yPart) {
                    return xPart < yPart ? -1 : 1;
                }
                continue;
            }

            if (xNum !== yNum) {
                return xNum - yNum;
            }
        }
        return 0;
    }
}

function getKeysString(selection) {
    return selection
        .map(item => item.key)
        .join('; ');
}

function distinct(array) {
    return [...new Set(array)];
}

function isMobile() {
    let check = false;
    (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
}