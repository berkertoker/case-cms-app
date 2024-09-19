const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser'); // Package import for process a CSV file

module.exports = {
  async afterCreate(event) {
    await processCsvFile(event);
  },

  async afterUpdate(event) {
    await processCsvFile(event);
  },
};

async function processCsvFile(event) {
  const { result } = event;
  let csvFileUrl = null;

  // Check if there is a CSV file
  if (result.uc_field && result.uc_field.url) {
    csvFileUrl = result.uc_field.url;
  }

  if (csvFileUrl) {
     // Path to the file on the server
    const csvFilePath = path.join(__dirname, '../../../../../public', csvFileUrl);
    // FAQ's id
    const faqId = result.id;

    const faqQuestions = [];
    // A flag to keep track of whether the first line has been skipped
    let isFirstRow = true; 

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csvParser({ headers: ['question', 'answer'] }))
        .on('data', (row) => {
          if (isFirstRow) {
            //Skip the first line because the first line is usually formatted
            isFirstRow = false;
            return;
          }

          faqQuestions.push({
            question: row.question,
            answer: row.answer,
            // Relation betweenn FAQ-Questions and FAQ
            faq: faqId,
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Add the data to the FAQ-Questions table one by one
    for (const faqQuestion of faqQuestions) {
      await strapi.entityService.create('api::faq-question.faq-question', {
        data: faqQuestion,
      });
    }
  }
}
