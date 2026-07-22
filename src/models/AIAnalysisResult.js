class AIAnalysisResult {


    constructor(){


        // AI hiểu chức năng gì
        this.featureUnderstanding = "";


        // Các điểm cần tập trung kiểm thử
        this.testFocus = [];


        // Khu vực rủi ro
        this.riskAreas = [];


        // Các kịch bản AI đề xuất
        this.suggestedScenarios = [];


        // Các câu hỏi cần làm rõ
        this.questions = [];


        // Ghi chú thêm
        this.notes = [];


        // Điểm tin cậy của AI
        // Ví dụ: 0.95
        this.confidence = 0;


    }


}


export default AIAnalysisResult;