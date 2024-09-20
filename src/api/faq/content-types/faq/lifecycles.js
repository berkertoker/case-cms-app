const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');

module.exports = {
  async afterCreate(event) {
    await processCsvFile(event);
  },

  async afterUpdate(event) {
    await processCsvFile(event);
  },
};

async function processCsvFile(event) {
  const { result, params } = event;
  let csvFileUrl = null;

  // Check if there is a CSV file
  if (result.uc_field && result.uc_field.url) {
    csvFileUrl = result.uc_field.url;
  }

  // Fetch the previous record to compare the CSV file URL
  const previousRecord = await strapi.entityService.findOne('api::faq.faq', result.id);

  // If the CSV file has changed or hasn't been processed yet
  if (csvFileUrl && (csvFileUrl !== previousRecord.uc_field?.url || !previousRecord.csvProcessed)) {
    const csvFilePath = path.join(__dirname, '../../../../../public', csvFileUrl);
    const faqId = result.id;

    const faqQuestions = [];
    let isFirstRow = true;

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csvParser({ headers: ['question', 'answer'] }))
        .on('data', (row) => {
          if (isFirstRow) {
            isFirstRow = false;
            return;
          }

          faqQuestions.push({
            question: row.question,
            answer: row.answer,
            faq: faqId,
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Find all existing FAQ questions associated with this FAQ
    const existingFaqQuestions = await strapi.entityService.findMany('api::faq-question.faq-question', {
      filters: { faq: faqId },
    });

    // Delete each of the found FAQ questions
    for (const faqQuestion of existingFaqQuestions) {
      await strapi.entityService.delete('api::faq-question.faq-question', faqQuestion.id);
    }

    // Add the new data from the CSV file
    for (const faqQuestion of faqQuestions) {
      await strapi.entityService.create('api::faq-question.faq-question', {
        data: faqQuestion,
      });
    }

    // Mark the CSV as processed
    await strapi.entityService.update('api::faq.faq', faqId, {
      data: { csvProcessed: true },
    });
  }
}
