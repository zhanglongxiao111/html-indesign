/**
 * Integration Test for Validator (Schema v2)
 * Run with: node test/validate.test.js
 */

const { validate, ERRORS } = require('../src/validator');

// 1. Mock Blueprint (Updated to match actual extract_blueprint.jsx output)
const mockBlueprint = {
  metadata: { exportedAt: "2025-01-01T00:00:00Z", documentName: "Test.indd" },
  
  // Separate style registries matching actual output
  paragraphStyles: {
    "Heading-1": { 
      name: "Heading-1", 
      css: "font-size: 24pt; color: #ff0000; font-family: Arial;" 
    },
    "Body-Text": { 
      name: "Body-Text", 
      css: "font-size: 12pt; color: #000000;" 
    }
  },
  
  characterStyles: {},
  
  objectStyles: {
    "[基本图形框架]": { name: "[基本图形框架]", css: "" },
    "[基本文本框架]": { name: "[基本文本框架]", css: "" }
  },
  
  compositeFonts: {},

  masters: {
    "A-Cover": {
      width: 210,
      height: 297,
      
      // Slots with appliedParagraphStyle (matching actual output)
      slots: {
        "Title": { 
          id: "123",
          label: "Title", 
          type: "TEXT", 
          appliedParagraphStyle: "Heading-1",
          bounds: {x:0,y:0,width:100,height:20},
          zIndex: 10,
          content: ""
        },
        "HeroImage": { 
          id: "124",
          label: "HeroImage", 
          type: "IMAGE", 
          bounds: {x:0,y:50,width:200,height:100},
          zIndex: 9
        }
      },

      // Static Items
      staticItems: [
        {
          id: "999",
          type: "RECT",
          bounds: {x:0,y:0,width:210,height:297},
          zIndex: 0,
          inlineCSS: "background-color:#ffffff"
        }
      ]
    }
  }
};

// 2. Good HTML
const goodHtml = `
  <section data-master="A-Cover">
    <div data-slot="Title">Project Alpha</div>
    <div data-slot="HeroImage"><img src="hero.jpg" /></div>
  </section>
`;

// 3. Bad HTML
const badHtml = `
  <section data-master="B-Unknown">
    <div data-slot="Anything">Fail</div>
  </section>

  <section data-master="A-Cover">
    <div data-slot="WrongSlotName">Fail</div>
    <div data-slot="HeroImage">This is text in an image slot</div>
  </section>
`;

console.log("Running Integration Tests (Schema v2)...");

// Test 1: Good HTML
const result1 = validate(goodHtml, mockBlueprint);
if (result1.valid === true) {
  console.log("✅ Test 1 (Valid HTML): PASSED");
} else {
  console.error("❌ Test 1 (Valid HTML): FAILED", result1.errors);
}

// Test 2: Bad HTML
const result2 = validate(badHtml, mockBlueprint);
if (result2.valid === false && result2.errors.length >= 3) {
  console.log("✅ Test 2 (Invalid HTML): PASSED");
} else {
  console.error("❌ Test 2 (Invalid HTML): FAILED");
  console.log(result2);
}