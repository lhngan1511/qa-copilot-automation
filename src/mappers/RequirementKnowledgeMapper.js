import RequirementKnowledge from "../models/RequirementKnowledge.js";

// Ngưỡng tin cậy tối thiểu để gán 1 câu trả lời làm rõ vào ĐÚNG 1 field cụ thể (2026-09-04, Ngân
// chốt: "gán sai âm thầm còn nguy hiểm hơn không gán") — dưới ngưỡng này KHÔNG được đoán, phải rơi
// về CONFIRMED_FACT đứng riêng (mergeApprovedClarifications, path cũ).
const FIELD_MATCH_CONFIDENCE_THRESHOLD = 0.5;

// Tiền tố loại control phổ biến trong tên field CSS-ID (asp.net/webform) — không mang ý nghĩa
// nghiệp vụ, phải cắt bỏ trước khi so khớp token với tên field AI nêu trong câu hỏi (nếu không,
// "txt_..."/"date_..." tự làm giảm điểm khớp một cách giả tạo).
const CONTROL_PREFIX_TOKENS = new Set(["txt", "txta", "date", "sr", "cbx", "chk", "sel", "ddl", "rad", "btn", "lbl"]);

export default class RequirementKnowledgeMapper {
    map({
        requirement = null,
        aiAnalysis = null,
        aiResult = null,
        clarificationQuestions = null,
        clarificationAnswers = null,
        approvedArtifact = null
    } = {}) {
        const artifact = this.isObject(approvedArtifact) ? approvedArtifact : {};
        const artifactKnowledge = this.isObject(artifact.knowledge) ? artifact.knowledge : {};
        const artifactAnalysis = this.isObject(artifact.aiAnalysis) ? artifact.aiAnalysis : {};
        const artifactRequirement = this.isObject(artifact.requirement) ? artifact.requirement : {};
        const parsedRequirement = this.isObject(requirement) ? requirement : {};
        const analysis = this.isObject(aiAnalysis)
            ? aiAnalysis
            : this.isObject(aiResult)
              ? aiResult
              : {};

        const module = this.firstMeaningful([
            artifactKnowledge.module,
            artifact.module,
            artifactRequirement.module,
            parsedRequirement.module
        ]);
        const purpose = this.firstText([
            artifactKnowledge.purpose,
            artifactAnalysis.purpose,
            analysis.purpose,
            artifactRequirement.purpose,
            parsedRequirement.purpose
        ]);
        const rawFunctions = this.firstCollection([
            artifactKnowledge.functions,
            artifactAnalysis.functions,
            analysis.functions,
            artifact.detectedFunctions,
            artifactRequirement.features,
            parsedRequirement.features,
            parsedRequirement.functions
        ]);
        // Bug thật (2026-09-03): câu trả lời Requirement Review "X có bắt buộc nhập không?" bị "rơi
        // mất" — không ảnh hưởng gì tới testcase sinh ra. Nguyên nhân: input.required phải được xác
        // định TRƯỚC khi validationRules được tính (deriveInputValidationRules dùng required để tự
        // sinh câu "không được để trống"); mergeApprovedClarifications trước đây chỉ chạy SAU KHI
        // functions đã tính xong, ghi vào knowledge.validationRules (mảng cấp toàn cục) mà
        // ScenarioRecommendationEngine không bao giờ đọc để SINH scenario mới (chỉ đọc
        // functions[i].validationRules — mảng riêng). Phải áp câu trả lời "bắt buộc" NGAY TRONG
        // normalizeFunctions(), ngay sau khi resolve được inputs thật của từng function (đầu vào
        // "thô" ở đây CHƯA có inputs — inputs chỉ được ghép từ reviewedFeatures bên trong hàm đó) —
        // xem tham số `artifact` truyền thêm cho normalizeFunctions.
        const functions = this.normalizeFunctions(
            rawFunctions,
            module,
            this.firstCollection([
                artifactRequirement.features,
                parsedRequirement.features
            ]),
            artifact
        );
        // Câu trả lời làm rõ KHÔNG PHẢI "bắt buộc nhập" (business rule/validation dạng khác/quyền) —
        // correlate theo field (so token tên field, ngưỡng tin cậy) hoặc theo OPERATION (từ khoá
        // thêm/sửa/xóa/tìm kiếm ngay trong câu hỏi) khi câu hỏi không gắn 1 field cụ thể (2026-09-04,
        // Ngân chốt hướng xử lý). Chạy SAU normalizeFunctions (cần nhìn được TẤT CẢ function cùng lúc
        // để biết function nào cùng operation) nhưng TRƯỚC khi model hoá RequirementFunctionKnowledge
        // (vẫn còn `inputs[]` thật — xem lý do ở applyRequiredFieldClarifications).
        const clarificationMeta = this.correlateClarificationAnswers(functions, artifact);
        const questions = this.collect([
            clarificationQuestions,
            artifact.clarificationQuestions,
            artifact.questions,
            artifactKnowledge.clarificationQuestions,
            artifactKnowledge.questions,
            artifactAnalysis.clarificationQuestions,
            artifactAnalysis.questions,
            analysis.clarificationQuestions,
            analysis.questions,
            parsedRequirement.clarificationQuestions,
            parsedRequirement.questions
        ]);
        const answers = this.collect([
            clarificationAnswers,
            artifact.clarificationAnswers,
            artifactKnowledge.clarificationAnswers,
            this.getAnsweredQuestions(artifact.questions)
        ]);

        const knowledge = new RequirementKnowledge({
            module,
            purpose,
            functions,
            approved: artifact.approvalStatus === "approved" || artifact.approved === true
        });

        knowledge.businessRules = this.firstCollection([
            this.collect([
                artifactKnowledge.businessRules,
                this.collectFunctionField(artifactKnowledge.functions, "businessRules")
            ]),
            this.collectFunctionField(artifactAnalysis.functions, "businessRules"),
            this.collectFunctionField(analysis.functions, "businessRules"),
            artifact.businessRules,
            artifactRequirement.businessRules,
            parsedRequirement.businessRules
        ]);
        knowledge.validationRules = this.firstCollection([
            this.collect([
                artifactKnowledge.validationRules,
                this.collectFunctionField(artifactKnowledge.functions, "validationRules")
            ]),
            this.collectFunctionField(artifactAnalysis.functions, "validationRules"),
            this.collectFunctionField(analysis.functions, "validationRules"),
            this.collect([artifact.validationRules, artifact.validation]),
            this.collect([
                artifactRequirement.validationRules,
                this.collectFeatureField(artifactRequirement.features, "validationRules")
            ]),
            this.collect([
                parsedRequirement.validationRules,
                this.collectFeatureField(parsedRequirement.features, "validationRules")
            ])
        ]);
        knowledge.permissions = this.firstCollection([
            this.collect([
                artifactKnowledge.permissions,
                this.collectFunctionField(artifactKnowledge.functions, "permissions")
            ]),
            this.collectFunctionField(artifactAnalysis.functions, "permissions"),
            this.collectFunctionField(analysis.functions, "permissions"),
            artifact.permissions,
            artifactRequirement.permissions,
            parsedRequirement.permissions
        ]);
        knowledge.dependencies = this.firstCollection([
            this.collect([
                artifactKnowledge.dependencies,
                this.collectFunctionField(artifactKnowledge.functions, "dependencies")
            ]),
            this.collect([
                artifactAnalysis.dependencies,
                this.collectFunctionField(artifactAnalysis.functions, "dependencies")
            ]),
            this.collect([
                analysis.dependencies,
                this.collectFunctionField(analysis.functions, "dependencies")
            ]),
            artifact.dependencies,
            artifactRequirement.dependencies,
            parsedRequirement.dependencies
        ]);
        knowledge.assumptions = this.firstCollection([
            this.collect([
                artifactKnowledge.assumptions,
                this.collectFunctionField(artifactKnowledge.functions, "assumptions")
            ]),
            this.collect([
                artifactAnalysis.assumptions,
                this.collectFunctionField(artifactAnalysis.functions, "assumptions")
            ]),
            this.collect([
                analysis.assumptions,
                this.collectFunctionField(analysis.functions, "assumptions")
            ]),
            artifact.assumptions,
            artifactRequirement.assumptions,
            parsedRequirement.assumptions
        ]);
        knowledge.clarificationQuestions = questions;
        knowledge.clarificationAnswers = answers;
        knowledge.risks = this.firstCollection([
            this.collect([artifactKnowledge.risks, artifactKnowledge.riskAreas]),
            this.collect([artifactAnalysis.risks, artifactAnalysis.riskAreas]),
            this.collect([analysis.risks, analysis.riskAreas]),
            this.collect([artifact.risks, artifact.riskAreas]),
            this.collect([artifactRequirement.risks, artifactRequirement.riskAreas]),
            this.collect([parsedRequirement.risks, parsedRequirement.riskAreas])
        ]);

        this.mergeApprovedClarifications(knowledge, artifact);
        // mergeApprovedClarifications() thay hẳn knowledge.knowledgeSources ở cuối hàm đó — phải gắn
        // clarificationMeta SAU khi nó chạy xong, không phải trước (nếu không sẽ bị ghi đè mất).
        knowledge.knowledgeSources = {
            ...(this.isObject(knowledge.knowledgeSources) ? knowledge.knowledgeSources : {}),
            clarificationMeta
        };
        return knowledge;
    }

    /** Bookkeeping cấp TOÀN CỤC (traceability qua knowledgeSources) — KHÔNG phải nơi bơm fact vào
     *  scenario generation. Bug thật đã gặp (2026-09-03/04, nhiều lượt): (1) ban đầu chỉ ghi ở đây,
     *  quên mất ScenarioRecommendationEngine chỉ đọc functions[i][field]; (2) sửa bằng cách bơm thêm
     *  vào knowledge.functions[i][field] NGAY TẠI ĐÂY — nhưng lúc này knowledge.functions đã là
     *  RequirementFunctionKnowledge (qua RequirementKnowledge#setFunctions ở map()), model đó KHÔNG
     *  giữ lại inputs[] nên không bao giờ correlate được field nào — bơm-vào-function chết lặng lẽ.
     *  Việc bơm vào đúng function/operation giờ làm ở correlateClarificationAnswers() (gọi trong
     *  map(), NGAY SAU normalizeFunctions() — lúc `inputs[]` còn tồn tại và thấy được TẤT CẢ function
     *  cùng lúc). Hàm này chỉ còn giữ traceability cấp toàn cục (mọi câu trả lời, kể cả đã correlate
     *  được vào function), không liên quan trực tiếp tới việc sinh scenario. */
    mergeApprovedClarifications(knowledge, artifact) {
        if (artifact.approvalStatus !== "approved" || !Array.isArray(artifact.questions)) return;
        const sources = this.isObject(knowledge.knowledgeSources) ? knowledge.knowledgeSources : {};
        for (const question of artifact.questions) {
            if (!this.isObject(question) || question.status !== "answered") continue;
            const answer = String(question.answer ?? "").trim();
            if (!answer) continue;
            const sourceId = String(question.questionId ?? question.id ?? "").trim();
            const category = this.mapClarificationCategory(question.category ?? question.type);
            const fact = this.composeClarificationFact(question);
            if (!fact) continue;
            const field = category.field;
            if (field) {
                knowledge[field] = this.mergeStringFact(knowledge[field], fact);
                sources[field] = sources[field] ?? {};
                this.addSourceReference(sources[field], fact, sourceId);
            } else {
                // Câu hỏi xác nhận NỘI DUNG THÔNG BÁO (vd "Thông báo chính xác khi xóa thành công
                // là gì?") đã được QACopilot#applyOracleConfirmationAnswers THAY THẲNG vào
                // feature.expectedResults của artifact.requirement TRƯỚC KHI gọi map() (xem ghi chú
                // ở đó) — không được sinh THÊM 1 CONFIRMED_FACT đứng riêng mô tả LẠI cùng sự kiện
                // bằng câu chữ khác, sẽ tạo ra 2 testcase gần như trùng lặp (bug thật đã gặp
                // 2026-09-04: TC005/TC006). Nhận biết "đã áp dụng" bằng cách khớp NGUYÊN VĂN answer
                // với đúng 1 feature.expectedResults — không cần lặp lại logic tìm feature ở đây.
                if (this.isAlreadyAppliedAsOracleConfirmation(question, artifact)) continue;
                knowledge.confirmedFacts = this.mergeStringFact(knowledge.confirmedFacts, fact);
                sources.confirmedFacts = sources.confirmedFacts ?? {};
                this.addSourceReference(sources.confirmedFacts, fact, sourceId);
            }
        }
        knowledge.knowledgeSources = sources;
    }

    /** So khớp với ĐÚNG giá trị mà QACopilot#applyOracleConfirmationAnswers thực sự ghi vào
     *  feature.expectedResults — với câu hỏi dạng "Xác nhận X là 'A' thay vì 'B'", giá trị áp dụng
     *  là A (phương án trong ngoặc kép), KHÔNG PHẢI answer nguyên văn "Có" (xem
     *  QACopilot#extractOracleConfirmationText — logic trích PHẢI giống hệt ở đây, nếu không sẽ
     *  không nhận ra câu hỏi đã được áp dụng, sinh trùng confirmedFacts). */
    isAlreadyAppliedAsOracleConfirmation(question, artifact) {
        const answer = String(question?.answer ?? "").trim();
        if (!answer) return false;
        const asked = String(question?.question ?? question?.content ?? "");
        const isYes = /^(có|yes|true|đúng)$/i.test(answer);
        let confirmedText = answer;
        if (isYes && /thay vì|hay là|\bhay\b/i.test(asked)) {
            const quoted = [...asked.matchAll(/["']([^"']+)["']/g)].map(m => m[1].trim()).filter(Boolean);
            if (quoted.length >= 2) confirmedText = quoted[0];
        }
        const features = Array.isArray(artifact?.requirement?.features) ? artifact.requirement.features : [];
        return features.some(
            feature =>
                Array.isArray(feature?.expectedResults) &&
                feature.expectedResults.length === 1 &&
                feature.expectedResults[0] === confirmedText
        );
    }

    /** Áp câu trả lời "X có bắt buộc nhập không?" lên đúng input.required trong 1 mảng inputs (của
     *  1 function) — gọi từ BÊN TRONG normalizeFunctions(), NGAY SAU khi inputs thật đã được resolve
     *  (ghép từ reviewedFeature nếu cần) và TRƯỚC deriveInputValidationRules(), để câu "không được để
     *  trống" tự sinh phản ánh đúng câu trả lời thật — thay vì mãi phụ thuộc vào required lúc parse
     *  ban đầu (thường "Chưa xác định", nhất là requirement dựng từ bản ghi CodeGen — input.required
     *  chỉ được xác nhận thật qua chính bước Requirement Review này). */
    applyRequiredFieldClarifications(inputs, artifact) {
        if (!Array.isArray(inputs) || inputs.length === 0) return;
        if (!this.isObject(artifact) || artifact.approvalStatus !== "approved" || !Array.isArray(artifact.questions)) return;
        for (const question of artifact.questions) {
            if (!this.isObject(question) || question.status !== "answered") continue;
            if (!this.isRequiredFieldQuestion(question)) continue;
            const required = this.isYes(this.normalizeRequiredFieldAnswer(question.answer));
            for (const input of this.matchInputsByName(inputs, question)) {
                input.required = required;
            }
        }
    }

    /** Chuẩn hoá câu trả lời câu hỏi "X có bắt buộc nhập không?" về đúng "Có"/"Không" trước khi dùng
     *  isYes()/isNo() (so khớp CHÍNH XÁC, không phải substring). Bug thật đã gặp (2026-09-04): câu
     *  hỏi field-bắt-buộc do QACopilot#synthesizeRequiredFieldQuestions tự sinh LÚC ĐẦU chưa gắn
     *  type/options YES_NO — UI hiển thị thành ô nhập tự do, tester trả lời tự nhiên "bắt buộc"/
     *  "không bắt buộc" thay vì đúng "Có"/"Không" — isYes()/isNo() không nhận ra, required KHÔNG BAO
     *  GIỜ được set, mất trắng toàn bộ N+M testcase âm tính trong công thức chuẩn. Đã sửa để câu hỏi
     *  MỚI luôn có type/options ép chọn nút — hàm này CHUẨN HOÁ THÊM để cứu dữ liệu các phiên ĐÃ trả
     *  lời tự do trước bản vá đó (không bắt tester trả lời lại). Không sửa isYes()/isNo() dùng CHUNG
     *  (rủi ro ảnh hưởng nhánh khác) — chỉ chuẩn hoá RIÊNG cho đúng ngữ cảnh field bắt buộc, nơi các
     *  từ đồng nghĩa này không mơ hồ. */
    normalizeRequiredFieldAnswer(answer) {
        const text = this.normalizeFactKey(answer);
        if (/^(không bắt buộc|không cần|không cần thiết|tùy chọn|tuỳ chọn|optional)$/.test(text)) {
            return "Không";
        }
        if (/^(bắt buộc|cần thiết|phải nhập|required)$/.test(text)) {
            return "Có";
        }
        return String(answer ?? "").trim();
    }

    /** Có phải câu hỏi "X có bắt buộc nhập không?" (Yes/No) hay không — CÙNG thứ tự ưu tiên nhận
     *  diện với composeClarificationFact() (loại trừ "duy nhất"/"xóa đang dùng"/"trùng tên" trước,
     *  vì các câu đó cũng có thể chứa chữ "bắt buộc" mà mang ý nghĩa khác hẳn). */
    isRequiredFieldQuestion(question) {
        const answer = this.normalizeRequiredFieldAnswer(question?.answer);
        if (!this.isYes(answer) && !this.isNo(answer)) return false;
        const asked = String(question?.question ?? question?.content ?? "").trim();
        if (!asked) return false;
        const askedKey = this.normalizeFactKey(asked);
        if (/duy nhất/.test(askedKey)) return false;
        if (/xóa|xoá/.test(askedKey) && /đang được sử dụng|đang sử dụng/.test(askedKey)) return false;
        if (/trùng/.test(askedKey) && /tên/.test(askedKey)) return false;
        return /bắt buộc/.test(askedKey);
    }

    /** Câu trả lời làm rõ KHÔNG PHẢI "bắt buộc nhập" (business rule/validation dạng khác/quyền) —
     *  correlate theo 2 tầng (2026-09-04, Ngân chốt hướng xử lý sau khi xem thử kết quả thật):
     *   1. FIELD_MATCH — so token tên field (đã chuẩn hoá, cắt tiền tố loại control + phần chung của
     *      form) với tên field AI nêu trong câu hỏi (thường trong dấu nháy đơn). Đạt ngưỡng tin cậy
     *      (FIELD_MATCH_CONFIDENCE_THRESHOLD) mới gán — DƯỚI ngưỡng bắt buộc rơi về CONFIRMED_FACT
     *      đứng riêng (mergeApprovedClarifications), không đoán bừa ("gán sai âm thầm nguy hiểm hơn
     *      không gán").
     *   2. OPERATION_MATCH — câu hỏi không nhắc field cụ thể (hoặc field không đạt ngưỡng) nhưng có
     *      nhắc rõ nghiệp vụ (thêm mới/sửa/xóa/tìm kiếm) — gán vào TẤT CẢ function cùng operation đó.
     *      Có thể sinh nhiều testcase nội dung giống nhau qua nhiều function cùng operation — CHẤP
     *      NHẬN ĐƯỢC (Ngân xác nhận): dedupe nếu cần làm ở tầng hiển thị cuối (nội dung y hệt), không
     *      chặn ở đây — chặn ở đây từng gây bug bỏ sót câu trả lời hợp lệ.
     *  Trả về map {questionId: {method, confidence?, question, answer, matchedFields?/matchedFunctions?}}
     *  để lưu vào knowledge.knowledgeSources.clarificationMeta — phục vụ hiển thị nguồn gốc/độ tin cậy
     *  trên UI chi tiết testcase (Ngân yêu cầu, để tự kiểm tra không cần đợi bug lộ qua nhiều vòng). */
    correlateClarificationAnswers(functions, artifact) {
        const metaByQuestion = {};
        if (!this.isObject(artifact) || artifact.approvalStatus !== "approved" || !Array.isArray(artifact.questions)) {
            return metaByQuestion;
        }
        const funcList = (Array.isArray(functions) ? functions : []).filter(f => this.isObject(f));
        const fieldIndex = funcList.map(func => ({ func, fields: this.fieldCoreTokens(func.inputs) }));

        for (const question of artifact.questions) {
            if (!this.isObject(question) || question.status !== "answered") continue;
            if (this.isRequiredFieldQuestion(question)) continue; // xử lý riêng qua input.required
            const category = this.mapClarificationCategory(question.category ?? question.type);
            const field = category.field;
            const sourceId = String(question.questionId ?? question.id ?? "").trim();
            const askedText = String(question.question ?? question.content ?? "").trim();
            const fact = this.composeClarificationFact(question);
            // Category không map được vào 1 bucket có thể correlate (vd "Exception" — chỉ ghi nhận
            // dạng CONFIRMED_FACT đứng riêng qua mergeApprovedClarifications, không có mảng
            // functions[i][field] nào để gộp vào) -> vẫn PHẢI ghi metaByQuestion (method NONE) để UI
            // hiển thị nguồn gốc đầy đủ cho MỌI câu hỏi đã trả lời, không chỉ câu correlate được.
            if (["businessRules", "validationRules", "permissions"].includes(field) && fact) {
                const fieldMatch = this.correlateByField(question, fieldIndex);
                if (fieldMatch) {
                    fieldMatch.func[field] = this.mergeStringFact(fieldMatch.func[field], fact);
                    if (sourceId) {
                        metaByQuestion[sourceId] = {
                            method: "FIELD_MATCH",
                            confidence: Math.round(fieldMatch.score * 100) / 100,
                            question: askedText,
                            answer: question.answer,
                            matchedFields: fieldMatch.matchedFieldLabels,
                            matchedFunction: fieldMatch.func.name ?? ""
                        };
                    }
                    continue;
                }

                const operationMatches = this.correlateByOperation(askedText, funcList);
                if (operationMatches.length > 0) {
                    for (const func of operationMatches) func[field] = this.mergeStringFact(func[field], fact);
                    if (sourceId) {
                        metaByQuestion[sourceId] = {
                            method: "OPERATION_MATCH",
                            question: askedText,
                            answer: question.answer,
                            matchedOperations: [...new Set(operationMatches.map(f => f.automation?.operation).filter(Boolean))],
                            matchedFunctions: operationMatches.map(f => f.name).filter(Boolean)
                        };
                    }
                    continue;
                }
            }

            if (sourceId) metaByQuestion[sourceId] = { method: "NONE", question: askedText, answer: question.answer };
        }
        return metaByQuestion;
    }

    /** So khớp câu hỏi với ĐÚNG 1 field cụ thể trong ĐÚNG 1 function. Câu hỏi có thể nêu NHIỀU field
     *  cùng lúc (vd 2 field ngày) — MỌI candidate phải đạt ngưỡng VÀ cùng quy về 1 function duy nhất
     *  mới coi là match (candidate nào không khớp gì, hoặc các candidate trỏ tới nhiều function khác
     *  nhau, đều bị coi là KHÔNG ĐỦ TIN CẬY — trả về null, đẩy xuống correlateByOperation). */
    correlateByField(question, fieldIndex) {
        const targetField = String(question?.targetField ?? "").trim();
        const candidates = targetField ? [targetField] : this.extractQuotedCandidates(question);
        if (candidates.length === 0) return null;

        const perCandidate = candidates.map(candidate => {
            const candTokens = this.tokenizeVN(candidate);
            if (candTokens.length === 0) return null;
            let bestScore = 0;
            let tied = [];
            for (const entry of fieldIndex) {
                for (const field of entry.fields) {
                    const score = this.coverageScore(candTokens, field.tokens);
                    if (score < FIELD_MATCH_CONFIDENCE_THRESHOLD) continue;
                    if (score > bestScore) {
                        bestScore = score;
                        tied = [{ func: entry.func, field }];
                    } else if (score === bestScore) {
                        tied.push({ func: entry.func, field });
                    }
                }
            }
            return bestScore > 0 ? { candidate, score: bestScore, tied } : null;
        });
        if (perCandidate.some(item => !item)) return null;

        let functionsInvolved = new Set(perCandidate.flatMap(item => item.tied.map(t => t.func)));
        if (functionsInvolved.size > 1) {
            // Field trùng tên/token giữa 2 function KHÁC NHAU (vd field tìm kiếm "mã đợt nhập học"
            // chỉ có 1 input duy nhất trong function SEARCH nên không bị cắt phần chung như field
            // cùng tên bên CREATE — coverage trùng tuyệt đối cả hai). Dùng từ khoá nghiệp vụ ngay
            // trong câu hỏi (thêm mới/sửa/xóa/tìm kiếm) để thu hẹp về ĐÚNG 1 function trước khi chịu
            // thua; vẫn mơ hồ sau bước này thì KHÔNG đoán (trả về null, đẩy xuống correlateByOperation).
            const askedText = String(question?.question ?? question?.content ?? "");
            const opMatches = this.correlateByOperation(askedText, [...functionsInvolved]);
            if (opMatches.length === 1) {
                const [narrowed] = opMatches;
                perCandidate.forEach(item => {
                    item.tied = item.tied.filter(t => t.func === narrowed);
                });
                if (perCandidate.some(item => item.tied.length === 0)) return null;
                functionsInvolved = new Set([narrowed]);
            }
        }
        if (functionsInvolved.size !== 1) return null;
        const [func] = functionsInvolved;
        const funcFields = fieldIndex.find(entry => entry.func === func)?.fields ?? [];

        return {
            func,
            score: Math.min(...perCandidate.map(item => item.score)),
            matchedFieldLabels: this.disambiguateFieldLabels(perCandidate, funcFields)
        };
    }

    /** Gắn nhãn field cho từng candidate khi hiển thị nguồn gốc — CHỈ ảnh hưởng nhãn hiển thị, không
     *  ảnh hưởng việc gán fact vào function nào (đã quyết ở correlateByField). Nếu mỗi candidate chỉ
     *  khớp đúng 1 field (không mơ hồ) thì lấy trực tiếp. Nếu 2+ candidate cùng khớp ngang điểm vào
     *  chung 1 nhóm field (vd "Ngày bắt đầu"/"Ngày kết thúc" cùng khớp cặp field ngày) — phân xử theo
     *  THỨ TỰ: thứ tự candidate xuất hiện trong câu hỏi khớp với thứ tự field xuất hiện trong luồng
     *  ghi hình (Ngân chốt 2026-09-04: dùng thứ tự flow, KHÔNG dùng so ký tự đầu — quá mong manh,
     *  không phải quy luật chung cho mọi cặp viết tắt). Không phân xử được rõ ràng thì liệt kê đủ các
     *  field khả dĩ, không đoán bừa. */
    disambiguateFieldLabels(perCandidate, funcFields) {
        if (perCandidate.every(item => item.tied.length === 1)) {
            return perCandidate.map(item => item.tied[0].field.rawName);
        }
        const tiedFieldsInFlowOrder = [...new Set(perCandidate.flatMap(item => item.tied.map(t => t.field)))]
            .sort((a, b) => a.index - b.index);
        if (tiedFieldsInFlowOrder.length === perCandidate.length) {
            return perCandidate.map((_, i) => tiedFieldsInFlowOrder[i]?.rawName).filter(Boolean);
        }
        return perCandidate.map(item => item.tied.map(t => t.field.rawName).join(" / "));
    }

    /** Câu hỏi không nêu field cụ thể (hoặc field không đạt ngưỡng) nhưng nhắc rõ nghiệp vụ — trả về
     *  TẤT CẢ function cùng operation đó (Ngân xác nhận 2026-09-04: chấp nhận nhiều testcase nội dung
     *  giống nhau, dedupe ở tầng hiển thị cuối nếu cần — không chặn ở đây). */
    correlateByOperation(askedText, funcList) {
        const ops = new Set();
        if (/thêm mới|tạo mới|thêm\b/i.test(askedText)) ops.add("CREATE");
        if (/sửa|cập nhật/i.test(askedText)) ops.add("UPDATE");
        if (/xóa|xoá/i.test(askedText)) ops.add("DELETE");
        if (/tìm kiếm|tra cứu/i.test(askedText)) ops.add("SEARCH");
        if (ops.size === 0) return [];
        return funcList.filter(func => ops.has(String(func?.automation?.operation ?? "").toUpperCase()));
    }

    /** Trích cụm trong dấu nháy đơn của câu hỏi làm ứng viên tên field — AI nhất quán trích nguyên
     *  văn tên field vào dấu nháy đơn khi hỏi về 1 field cụ thể (vd "...'Mã đợt nhập học'..."),
     *  đáng tin hơn hẳn so với tách câu theo mẫu cố định (chỉ đúng với đúng 1 cách đặt câu). */
    extractQuotedCandidates(question) {
        const asked = String(question?.question ?? question?.content ?? "");
        return [...asked.matchAll(/'([^']+)'/g)].map(m => m[1].trim()).filter(Boolean);
    }

    tokenizeVN(text) {
        return String(text ?? "")
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "d")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim()
            .split(" ")
            .filter(Boolean);
    }

    stripControlPrefixTokens(tokens) {
        const result = [...tokens];
        while (result.length > 1 && CONTROL_PREFIX_TOKENS.has(result[0])) result.shift();
        return result;
    }

    /** Cắt phần chung ĐẦU và CUỐI giữa các mảng token (form-code lặp lại ở mọi field của CÙNG 1
     *  function, vd "tddotnhaphoc" ở đầu, "dot_nhap_hoc" ở cuối) — chỉ giữ phần PHÂN BIỆT từng field.
     *  Không cắt nếu kết quả rỗng (field chỉ có 1 trong function, hoặc cắt hết sạch — giữ nguyên bản
     *  gốc để còn cái mà so khớp). */
    stripCommonAffixTokens(tokenLists) {
        if (tokenLists.length < 2) return tokenLists;
        const minLen = Math.min(...tokenLists.map(t => t.length));
        let prefixLen = 0;
        outer: for (let i = 0; i < minLen; i++) {
            const tok = tokenLists[0][i];
            for (const list of tokenLists) if (list[i] !== tok) break outer;
            prefixLen++;
        }
        let suffixLen = 0;
        outer2: for (let i = 0; i < minLen - prefixLen; i++) {
            const tok = tokenLists[0][tokenLists[0].length - 1 - i];
            for (const list of tokenLists) if (list[list.length - 1 - i] !== tok) break outer2;
            suffixLen++;
        }
        return tokenLists.map(list => {
            const stripped = list.slice(prefixLen, list.length - suffixLen || undefined);
            return stripped.length ? stripped : list;
        });
    }

    /** Với TẤT CẢ input của 1 function: tách token, cắt tiền tố loại control rồi cắt phần chung
     *  đầu/cuối giữa các field CÙNG function đó — trả về {rawName, tokens, index} (index = thứ tự
     *  xuất hiện trong mảng inputs, dùng để phân xử khi 2+ field ngang điểm — xem disambiguateFieldLabels). */
    fieldCoreTokens(inputs) {
        const list = (Array.isArray(inputs) ? inputs : []).map(input => {
            const rawName = String(input?.name ?? input?.inputName ?? input?.fieldName ?? "").trim();
            const tokens = this.stripControlPrefixTokens(this.tokenizeVN(rawName.replace(/^#/, "")));
            return { rawName, tokens };
        });
        const strippedTokenLists = this.stripCommonAffixTokens(list.map(item => item.tokens));
        return list.map((item, index) => ({
            rawName: item.rawName,
            tokens: strippedTokenLists[index],
            index
        }));
    }

    /** Điểm khớp = tỉ lệ token của CANDIDATE (cụm AI nêu trong câu hỏi) được field "giải thích" —
     *  tính từ phía candidate (không phải Jaccard đối xứng) vì tên field CSS-ID thường có thêm token
     *  kỹ thuật không liên quan (vd "svnh_td") mà bản thân nó không nói lên field đó SAI — chỉ là
     *  nhiễu, không nên làm giảm điểm khi so với câu hỏi bằng ngôn ngữ tự nhiên. */
    coverageScore(candidateTokens, fieldTokens) {
        if (candidateTokens.length === 0) return 0;
        const fieldSet = new Set(fieldTokens);
        const intersection = candidateTokens.filter(token => fieldSet.has(token));
        return intersection.length / candidateTokens.length;
    }

    /** Tìm các input (trong 1 mảng inputs) mà 1 câu hỏi làm rõ nhắc tới — ưu tiên targetField; nếu
     *  trống/không khớp field nào, tách tên trường từ chính câu hỏi (câu hỏi có thể liệt kê NHIỀU
     *  trường cùng lúc, vd "Mã X, Tên Y, Số Z có bắt buộc nhập hay không?" — targetField do AI sinh
     *  chỉ hỗ trợ đúng 1 trường/câu hỏi nên trường hợp nhiều trường thường rỗng/không dùng được). */
    matchInputsByName(inputs, question) {
        if (!Array.isArray(inputs) || inputs.length === 0) return [];
        const asked = String(question?.question ?? question?.content ?? "").trim();
        const targetField = this.normalizeFactKey(question?.targetField ?? "");
        const candidateNames = targetField ? [targetField] : this.extractFieldNames(asked);
        if (candidateNames.length === 0) return [];
        return inputs.filter(input => {
            if (!this.isObject(input)) return false;
            const inputName = this.normalizeFactKey(input.name ?? input.inputName ?? input.fieldName ?? "");
            return inputName && candidateNames.some(name => this.namesOverlap(name, inputName));
        });
    }

    /** Tách danh sách tên trường khỏi câu hỏi liệt kê nhiều trường, vd "Mã đợt nhập học, Tên đợt
     *  nhập học, Số quyết định có bắt buộc nhập hay không?" -> 3 tên trường riêng biệt. */
    extractFieldNames(asked) {
        const subject = this.subjectBefore(asked, /có bắt buộc/i) || asked;
        return subject
            .split(/,|\bvà\b/i)
            .map(part => this.normalizeFactKey(part))
            .filter(Boolean);
    }

    namesOverlap(a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        return (a.length >= 3 && b.includes(a)) || (b.length >= 3 && a.includes(b));
    }

    composeClarificationFact(question) {
        const answer = String(question?.answer ?? "").trim();
        const asked = String(question?.question ?? question?.content ?? "").trim();
        if (!answer) return "";
        const yes = this.isYes(answer);
        const no = this.isNo(answer);
        if (!yes && !no) {
            if (/vai trò|role|nhóm người dùng|quyền/.test(this.normalizeFactKey(asked))) {
                return `Chỉ ${answer} được quyền thực hiện thêm, sửa, xóa`;
            }
            return answer;
        }
        if (!asked) return "";
        const field = String(question?.targetField ?? "").trim();
        const askedKey = this.normalizeFactKey(asked);
        if (/duy nhất/.test(askedKey)) {
            const subject = field || this.subjectBefore(asked, /có bắt buộc phải duy nhất|có phải là duy nhất|phải duy nhất|có duy nhất/i);
            return yes
                ? `${subject || "Giá trị"} phải là duy nhất trong hệ thống`
                : `${subject || "Giá trị"} không bắt buộc phải duy nhất`;
        }
        if (/xóa|xoá/.test(askedKey) && /đang được sử dụng|đang sử dụng/.test(askedKey)) {
            return yes
                ? "Được phép xóa bản ghi đang được sử dụng"
                : "Không được phép xóa bản ghi đang được sử dụng";
        }
        if (/trùng/.test(askedKey) && /tên/.test(askedKey)) {
            return yes ? "Tên được phép trùng lặp" : "Tên không được phép trùng lặp";
        }
        if (/bắt buộc/.test(askedKey)) {
            const subject = field || this.subjectBefore(asked, /có bắt buộc/i);
            return yes ? `${subject || "Trường"} là bắt buộc` : `${subject || "Trường"} không bắt buộc`;
        }
        // Bug thật đã gặp (2026-09-04): câu hỏi Yes/No không khớp mẫu cụ thể nào ở trên (vd "có phân
        // biệt chữ hoa/chữ thường không?") trước đây trả về "" -> câu trả lời bị BỎ RƠI HOÀN TOÀN dù
        // targetField đã xác định đúng field. Bản vá đầu tiên (nối thô "câu hỏi — Có/Không") tạo ra
        // câu văn xấu, lộ ra nguyên văn thành 1 testcase CONFIRMED_FACT đứng riêng (mergeConfirmedFacts
        // trong ScenarioRecommendationEngine.js dùng fact gần như nguyên văn làm tiêu đề/kết quả mong
        // đợi — nó vốn được thiết kế cho câu văn hoàn chỉnh như các nhánh mẫu ở trên, không phải chuỗi
        // nối thô). Cố gắng tháo khung câu hỏi theo NHIỀU cấu trúc câu hỏi Yes/No khác nhau (AI diễn
        // đạt không nhất quán) trước khi lùi về nối thô (còn hơn rơi mất hoàn toàn):
        //   1. "Xác nhận X là 'A' thay vì 'B'" (so sánh 2 phương án trong ngoặc kép, KHÔNG có "...
        //      không?" nên #3 không xử lý được) — bug thật đã gặp (2026-09-04, TC005: "Xác nhận kết
        //      quả hiển thị sau khi xóa là 'Đã xóa thành công các đợt nhập học' thay vì 'Đã xóa
        //      thành công các đợt nhậ'" bị nối thô vì không khớp mẫu nào).
        //   2. "Có [danh từ] nào [mệnh đề] không?" (câu hỏi TỒN TẠI, "có" là động từ đầu câu — khác
        //      "<chủ ngữ> có <vị ngữ> không?" mà #3 xử lý) — bug thật đã gặp (2026-09-04, TC006: "Có
        //      quy tắc nào về việc không cho phép xóa... không?" bị nối thô vì #3 tìm nhầm "có" ở
        //      VỊ TRÍ 0 làm điểm tách chủ ngữ/vị ngữ, ra chủ ngữ rỗng, luôn thất bại).
        //   3. "<chủ ngữ> có <vị ngữ> không?" (unwrapYesNoQuestion — mẫu phổ biến nhất, giữ nguyên).
        const quotedConfirmation = this.unwrapQuotedConfirmationQuestion(asked, yes);
        if (quotedConfirmation) return quotedConfirmation;
        const existential = this.unwrapExistentialQuestion(asked, yes);
        if (existential) return existential;
        const unwrapped = this.unwrapYesNoQuestion(asked, yes);
        if (unwrapped) return unwrapped;
        const questionText = asked.replace(/\?+\s*$/, "").trim();
        return questionText ? `${questionText} — ${yes ? "Có" : "Không"}` : "";
    }

    /** Tháo câu hỏi kiểu "Xác nhận [X] là 'A' thay vì 'B'" (so sánh 2 phương án, KHÔNG theo dạng
     *  "... không?" nên unwrapYesNoQuestion không xử lý được) — trả lời "Có" nghĩa là phương án ĐẦU
     *  TIÊN trong ngoặc kép đúng, dùng nguyên văn A làm fact. Trả lời "Không" -> không đoán được
     *  phương án nào đúng chỉ từ chính câu hỏi, để rơi về nhánh khác. Yêu cầu CẢ 2 điều kiện: có từ
     *  khoá so sánh ("thay vì"/"hay là"/"hay") VÀ ít nhất 2 cụm trong ngoặc kép — nếu chỉ cần "có
     *  ngoặc kép" sẽ bắt NHẦM các câu hỏi Yes/No bình thường khác tình cờ trích dẫn 1 giá trị (vd "Có
     *  cho phép ký tự đặc biệt như 'a/b' không?"), lấy nhầm giá trị trích dẫn đó làm fact. Chấp nhận
     *  cả 2 loại dấu ngoặc kép ' và " (AI không nhất quán loại dấu dùng khi đặt câu hỏi). */
    unwrapQuotedConfirmationQuestion(asked, yes) {
        if (!yes) return "";
        if (!/thay vì|hay là|\bhay\b/i.test(asked)) return "";
        const quoted = [...asked.matchAll(/["']([^"']+)["']/g)].map(m => m[1].trim()).filter(Boolean);
        return quoted.length >= 2 ? quoted[0] : "";
    }

    /** Tháo khung câu hỏi TỒN TẠI "Có [danh từ] nào [mệnh đề] không?" (khác "<chủ ngữ> có <vị ngữ>
     *  không?" mà unwrapYesNoQuestion() xử lý — "có" ở đây là ĐỘNG TỪ TỒN TẠI đầu câu, không phải
     *  liên từ giữa câu, nên unwrapYesNoQuestion tìm nhầm coIndex ở VỊ TRÍ 0 -> chủ ngữ rỗng -> luôn
     *  thất bại). Ví dụ: "Có quy tắc nào về việc không cho phép xóa đợt nhập học nếu đã có dữ liệu
     *  sinh viên phát sinh không?" + "Có" -> "Không cho phép xóa đợt nhập học nếu đã có dữ liệu sinh
     *  viên phát sinh." */
    unwrapExistentialQuestion(asked, yes) {
        const match = asked.match(/^\s*có\s+.+?\bnào\b\s+(.+?)\s*\?*\s*$/i);
        if (!match) return "";
        const clause = match[1]
            .replace(/\s+không\s*$/i, "")
            .trim()
            .replace(/^về việc\s+/i, "")
            .trim();
        if (!clause) return "";
        const capitalized = clause.charAt(0).toLocaleUpperCase("vi") + clause.slice(1);
        const sentence = yes ? capitalized : `Không có quy tắc: ${clause}`;
        return /[.!]$/.test(sentence) ? sentence : `${sentence}.`;
    }

    /** Tháo khung câu hỏi "<chủ ngữ> có <vị ngữ> (hay) không?" thành câu khẳng định/phủ định. Tách
     *  theo TOKEN (khoảng trắng), KHÔNG dùng regex \b — \b trong JS coi nguyên âm có dấu tiếng Việt
     *  (vd "ó" trong "có") là ký tự "không thuộc từ", nên `\bcó\b` LUÔN KHÔNG khớp khi "có" đứng
     *  trước khoảng trắng/dấu câu (bug thật đã gặp khi viết bằng regex \b, phải đổi cách làm). */
    unwrapYesNoQuestion(asked, yes) {
        const tokens = asked.trim().split(/\s+/);
        const stripPunct = token => token.replace(/^[.,;:!?'"()[\]]+|[.,;:!?'"()[\]]+$/g, "");
        const coIndex = tokens.findIndex(token => stripPunct(token).toLocaleLowerCase("vi") === "có");
        let khongIndex = -1;
        for (let i = tokens.length - 1; i > coIndex; i -= 1) {
            if (stripPunct(tokens[i]).toLocaleLowerCase("vi") === "không") {
                khongIndex = i;
                break;
            }
        }
        if (coIndex === -1 || khongIndex === -1) return "";
        const subject = tokens.slice(0, coIndex).join(" ").trim();
        const predicate = tokens.slice(coIndex + 1, khongIndex).join(" ").trim();
        if (!subject || !predicate) return "";
        const sentence = yes ? `${subject} ${predicate}` : `${subject} không ${predicate}`;
        return sentence.charAt(0).toLocaleUpperCase("vi") + sentence.slice(1);
    }

    isYes(value) {
        return /^(có|yes|true|đúng)$/i.test(String(value ?? "").trim());
    }

    isNo(value) {
        return /^(không|no|false|sai)$/i.test(String(value ?? "").trim());
    }

    subjectBefore(question, marker) {
        const text = String(question ?? "");
        const match = text.match(new RegExp(`^(.+?)\\s+${marker.source}`, marker.flags));
        return String(match?.[1] ?? "")
            .replace(/^(nếu|khi|liệu)\s+/i, "")
            .trim();
    }

    mapClarificationCategory(value) {
        const category = String(value ?? "").trim().toLowerCase();
        if (category === "business rule" || category === "business_rule") return { field: "businessRules" };
        if (category === "validation") return { field: "validationRules" };
        if (category === "permission") return { field: "permissions" };
        if (category === "boundary") return { field: "boundaryCases" };
        return { field: "" };
    }

    mergeStringFact(values, fact) {
        const current = Array.isArray(values) ? values.filter(value => typeof value === "string") : [];
        const key = this.normalizeFactKey(fact);
        return current.some(value => this.normalizeFactKey(value) === key) ? current : [...current, fact];
    }

    addSourceReference(bucket, fact, sourceId) {
        const key = this.normalizeFactKey(fact);
        const references = Array.isArray(bucket[key]) ? bucket[key] : [];
        const source = { sourceType: "CLARIFICATION", sourceId };
        if (sourceId && !references.some(item => item?.sourceType === source.sourceType && item?.sourceId === source.sourceId)) references.push(source);
        bucket[key] = references;
    }

    normalizeFactKey(value) {
        return String(value ?? "").trim().toLowerCase().replace(/\\s+/g, " ");
    }

    normalizeFunctions(functions, module, reviewedFeatures = [], artifact = null) {
        const moduleId = this.isObject(module) ? module.id : "";

        return functions.map(value => {
            if (!this.isObject(value)) return value;

            const reviewedFeature = (Array.isArray(reviewedFeatures) ? reviewedFeatures : []).find(
                feature =>
                    this.isObject(feature) &&
                    ((value.id && feature.id && String(value.id) === String(feature.id)) ||
                        this.normalizeFactKey(feature.name ?? feature.feature ?? feature.title) ===
                            this.normalizeFactKey(value.name ?? value.feature ?? value.title))
            );
            // Clone TRƯỚC khi áp câu trả lời "bắt buộc" — inputs ở đây có thể là tham chiếu thẳng
            // tới reviewedFeature.inputs (dữ liệu requirement gốc của caller); applyRequiredFieldClarifications
            // mutate input.required tại chỗ nên phải mutate trên bản sao, không phải object gốc.
            const inputs = this.clone(
                Array.isArray(value.inputs) && value.inputs.length > 0
                    ? value.inputs
                    : Array.isArray(reviewedFeature?.inputs)
                      ? reviewedFeature.inputs
                      : []
            );
            // Bug thật (2026-09-03, xem ghi chú ở map()) — PHẢI áp câu trả lời "X có bắt buộc nhập
            // không?" vào input.required NGAY ĐÂY, trước deriveInputValidationRules() bên dưới, nếu
            // không câu trả lời không có tác dụng gì lên testcase sinh ra.
            this.applyRequiredFieldClarifications(inputs, artifact);
            // Câu trả lời làm rõ KHÁC (không phải "bắt buộc nhập") được correlate ở correlateClarificationAnswers()
            // — chạy SAU normalizeFunctions() (cần thấy TẤT CẢ function cùng lúc để biết function nào
            // cùng operation — xem lời gọi ở map()), mutate thẳng businessRules/validationRules/permissions
            // của object trả về ở đây. Không làm ở đây (như bản trước, collectClarificationFacts theo
            // TỪNG function) vì không có cách nào biết CÁC function khác để correlate theo operation.
            const businessRules = this.toTextArray(value.businessRules ?? value.rules);
            const validationRules = this.toTextArray(this.collect([
                value.validationRules,
                value.validations,
                this.deriveInputValidationRules(inputs)
            ]));
            const permissions = this.toTextArray(this.collect([
                value.permissions,
                value.permissionRules,
                (Array.isArray(value.preconditions) ? value.preconditions : []).filter(
                    item => typeof item === "string" && /quyền/i.test(item)
                )
            ]));
            const references = this.collect([
                value.requirementReferences,
                value.references,
                businessRules
                    .map((_rule, index) => value.businessRules?.[index]?.code)
                    .filter(Boolean)
            ]);

            return {
                ...this.clone(value),
                inputs: this.clone(inputs),
                moduleId: value.moduleId ?? moduleId,
                name: value.name ?? value.feature ?? value.title,
                businessRules,
                validationRules,
                permissions,
                boundaries: this.toTextArray(value.boundaries ?? value.boundaryCases),
                requirementReferences: this.toTextArray(references)
            };
        });
    }

    deriveInputValidationRules(inputs) {
        return (Array.isArray(inputs) ? inputs : []).flatMap(input => {
            if (!this.isObject(input)) return input;

            const name = input.name ?? input.inputName ?? input.fieldName;
            const rules = [];

            if (input.required === true) {
                rules.push(this.withInputName(name, "không được để trống"));
            }

            const description =
                input.description ?? input.rule ?? input.rules ?? input.content ?? "";
            const contextualRule = this.withInputName(name, description);
            if (contextualRule && !/^chưa xác định$/i.test(String(description).trim())) {
                rules.push(contextualRule);
            }

            return rules;
        });
    }

    toTextArray(values) {
        return this.collect([values])
            .map(value =>
                typeof value === "string"
                    ? value
                    : this.isObject(value)
                      ? (value.content ?? value.description ?? value.name)
                      : ""
            )
            .filter(value => typeof value === "string" && value.trim())
            .map(value => value.trim());
    }

    withInputName(name, rule) {
        const normalizedName = typeof name === "string" ? name.trim() : "";
        const normalizedRule = typeof rule === "string" ? rule.trim() : "";

        if (!normalizedRule || !normalizedName) {
            return normalizedRule;
        }

        return normalizedRule
            .toLocaleLowerCase("vi")
            .startsWith(normalizedName.toLocaleLowerCase("vi"))
            ? normalizedRule
            : `${normalizedName} ${normalizedRule}`;
    }

    collectFeatureField(features, field) {
        return (Array.isArray(features) ? features : []).flatMap(feature =>
            this.isObject(feature) && Array.isArray(feature[field]) ? feature[field] : []
        );
    }

    collectFunctionField(functions, field) {
        return (Array.isArray(functions) ? functions : []).flatMap(item =>
            this.isObject(item) && Array.isArray(item[field]) ? item[field] : []
        );
    }

    firstCollection(collections) {
        const source = collections.find(value => Array.isArray(value) && value.length > 0);
        return source ? this.collect([source]) : [];
    }

    getAnsweredQuestions(questions) {
        return (Array.isArray(questions) ? questions : []).filter(
            question =>
                this.isObject(question) &&
                typeof question.answer === "string" &&
                question.answer.trim() !== ""
        );
    }

    collect(collections) {
        const result = [];
        const seen = new Set();

        collections
            .flatMap(value => (Array.isArray(value) ? value : []))
            .forEach(value => {
                const normalized = this.normalizeValue(value);
                if (normalized === null) return;

                const key = this.comparisonKey(normalized);
                if (seen.has(key)) return;

                seen.add(key);
                result.push(this.clone(normalized));
            });

        return result;
    }

    normalizeValue(value) {
        if (typeof value === "string") {
            const normalized = value.trim();
            return normalized || null;
        }
        if (this.isObject(value)) {
            return Object.keys(value).length > 0 ? value : null;
        }
        return value === null || value === undefined ? null : value;
    }

    firstMeaningful(values) {
        const value = values.find(item => this.normalizeValue(item) !== null);
        return value === undefined ? undefined : this.clone(value);
    }

    firstText(values) {
        const value = values.find(item => typeof item === "string" && item.trim());
        return typeof value === "string" ? value.trim() : "";
    }

    comparisonKey(value) {
        return typeof value === "string"
            ? `string:${value.toLowerCase()}`
            : `value:${JSON.stringify(value)}`;
    }

    isObject(value) {
        return Boolean(value && typeof value === "object" && !Array.isArray(value));
    }

    clone(value) {
        if (Array.isArray(value)) return value.map(item => this.clone(item));
        if (this.isObject(value)) {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, this.clone(item)])
            );
        }
        return value;
    }
}
